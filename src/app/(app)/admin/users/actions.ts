"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole, SessionUser } from "@/lib/types";
import {
  ROLE_INFO,
  checkUserChange,
  createUserSchema,
  parseSkills,
  resetPasswordSchema,
  updateUserSchema,
  type CreateUserValues,
  type ResetPasswordValues,
  type UpdateUserValues,
} from "@/lib/users";
import { auditMfa } from "@/lib/mfa";
import type { ActionResult } from "../actions";

// User management. Accounts live in auth.users (service role only) + public.profiles, so
// these actions use the service-role client, always behind requireUser(["admin"]).
// Every change is written to user_admin_events. Passwords are never logged.

type Admin = ReturnType<typeof createAdminClient>;
type AuditAction = "user_created" | "user_updated" | "role_changed" | "user_deactivated" | "user_reactivated" | "password_reset";

const BANNED = "876000h"; // ~100 years: a deactivated account can't sign in or refresh its session

function flattenIssues(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

function revalidateUserViews() {
  revalidatePath("/admin/users");
  revalidatePath("/admin/technicians");
  revalidatePath("/audit");
}

async function audit(
  admin: Admin,
  actor: SessionUser,
  action: AuditAction,
  target: { id: string; name: string; email: string | null },
  changes: Record<string, { from: unknown; to: unknown }> = {},
) {
  const { error } = await admin.from("user_admin_events").insert({
    actor_id: actor.id,
    actor_name: actor.fullName,
    action,
    target_id: target.id,
    target_name: target.name,
    target_email: target.email,
    changes,
  });
  if (error) console.error("user_admin_events insert failed:", error.message);
}

async function branchName(admin: Admin, id: number | null) {
  if (id === null) return null;
  const { data } = await admin.from("branches").select("name").eq("id", id).maybeSingle();
  return data?.name ?? String(id);
}

async function openJobs(admin: Admin, technicianId: string | undefined) {
  if (!technicianId) return 0;
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("assigned_technician_id", technicianId)
    .in("status", ["assigned", "in_progress", "rework"]);
  return count ?? 0;
}

// ------------------------------------------------------------------ create --

export async function createUserAction(values: CreateUserValues): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser(["admin"]);
  const parsed = createUserSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields", fieldErrors: flattenIssues(parsed.error.issues) };
  const v = parsed.data;
  const admin = createAdminClient();
  const branchId = Number(v.branchId);
  const linkTech = v.role === "technician" && v.technicianId !== "" ? v.technicianId : null;

  if (linkTech) {
    const { data: t } = await admin.from("technicians").select("id, profile_id").eq("id", linkTech).maybeSingle();
    if (!t) return { ok: false, error: "That technician record no longer exists", fieldErrors: { technicianId: "Choose again" } };
    if (t.profile_id) return { ok: false, error: "That technician already has a login", fieldErrors: { technicianId: "Already linked" } };
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { full_name: v.fullName },
  });
  if (authError || !created.user) {
    const taken = authError?.code === "email_exists" || /already (been )?registered/i.test(authError?.message ?? "");
    if (taken) return { ok: false, error: "An account with this email already exists", fieldErrors: { email: "Already in use" } };
    if (authError?.code === "weak_password") return { ok: false, error: authError.message, fieldErrors: { password: "Too weak" } };
    return { ok: false, error: authError?.message ?? "Could not create the account" };
  }
  const id = created.user.id;

  // From here on, any failure removes the new auth user again (profile + technician cascade).
  const rollback = async (message: string): Promise<ActionResult<{ id: string }>> => {
    await admin.auth.admin.deleteUser(id);
    return { ok: false, error: message };
  };

  const { error: profileError } = await admin.from("profiles").insert({
    id,
    full_name: v.fullName,
    email: v.email,
    role: v.role,
    branch_id: branchId,
    phone: v.phone || null,
    active: true,
  });
  if (profileError) return rollback(`Could not create the profile: ${profileError.message}`);

  if (v.role === "technician") {
    const { error } = linkTech
      ? await admin.from("technicians").update({ profile_id: id, active: true }).eq("id", linkTech).is("profile_id", null)
      : await admin.from("technicians").insert({
          profile_id: id,
          name: v.fullName,
          phone: v.phone,
          branch_id: branchId,
          team_code: v.teamCode.toUpperCase(),
          skills: parseSkills(v.skills),
        });
    if (error) {
      await admin.from("profiles").delete().eq("id", id);
      return rollback(`Could not set up the technician record: ${error.message}`);
    }
  }

  await audit(admin, actor, "user_created", { id, name: v.fullName, email: v.email }, {
    role: { from: null, to: v.role },
    branch: { from: null, to: await branchName(admin, branchId) },
    ...(linkTech ? { technician: { from: null, to: "linked existing roster entry" } } : {}),
  });
  revalidateUserViews();
  return { ok: true, data: { id } };
}

// ------------------------------------------------------------------ update --

export async function updateUserAction(values: UpdateUserValues): Promise<ActionResult> {
  const actor = await requireUser(["admin"]);
  const parsed = updateUserSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields", fieldErrors: flattenIssues(parsed.error.issues) };
  const v = parsed.data;
  const admin = createAdminClient();
  const branchId = Number(v.branchId);

  const { data: current } = await admin
    .from("profiles")
    .select("id, full_name, email, role, active, phone, branch_id")
    .eq("id", v.id)
    .maybeSingle();
  if (!current) return { ok: false, error: "This user no longer exists" };
  const { data: tech } = await admin.from("technicians").select("id, team_code, skills, active").eq("profile_id", v.id).maybeSingle();

  const { count: activeAdmins } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("active", true);
  const blocked = checkUserChange({
    actorId: actor.id,
    targetId: v.id,
    current: { role: current.role as AppRole, active: current.active },
    next: { role: v.role, active: v.active },
    activeAdmins: activeAdmins ?? 0,
    openJobs: await openJobs(admin, tech?.id),
  });
  if (blocked) return { ok: false, error: blocked };
  if (v.role === "technician" && !tech && v.teamCode === "") {
    return { ok: false, error: "Enter a team code for the technician", fieldErrors: { teamCode: "Required for technicians" } };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: v.fullName, role: v.role, active: v.active, phone: v.phone || null, branch_id: branchId })
    .eq("id", v.id);
  if (profileError) return { ok: false, error: `Could not save: ${profileError.message}` };

  // Roster entry follows the account: technicians keep one (active while the account is);
  // someone who stops being a technician keeps their history but leaves the roster.
  if (v.role === "technician") {
    const fields = {
      name: v.fullName,
      phone: v.phone,
      branch_id: branchId,
      active: v.active,
      ...(v.teamCode ? { team_code: v.teamCode.toUpperCase() } : {}),
      skills: parseSkills(v.skills),
    };
    const { error } = tech
      ? await admin.from("technicians").update(fields).eq("id", tech.id)
      : await admin.from("technicians").insert({ ...fields, profile_id: v.id, team_code: v.teamCode.toUpperCase() });
    if (error) return { ok: false, error: `Saved the account, but the technician record failed: ${error.message}` };
  } else if (tech?.active) {
    await admin.from("technicians").update({ active: false }).eq("id", tech.id);
  }

  if (current.active !== v.active || current.full_name !== v.fullName) {
    const { error } = await admin.auth.admin.updateUserById(v.id, {
      user_metadata: { full_name: v.fullName },
      ...(current.active !== v.active ? { ban_duration: v.active ? "none" : BANNED } : {}),
    });
    if (error) return { ok: false, error: `Saved, but sign-in access could not be updated: ${error.message}` };
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const diff = (key: string, from: unknown, to: unknown) => {
    if ((from ?? "") !== (to ?? "")) changes[key] = { from, to };
  };
  diff("name", current.full_name, v.fullName);
  diff("role", ROLE_INFO[current.role as AppRole].label, ROLE_INFO[v.role].label);
  diff("status", current.active ? "Active" : "Deactivated", v.active ? "Active" : "Deactivated");
  diff("phone", current.phone, v.phone || null);
  if (current.branch_id !== branchId) changes.branch = { from: await branchName(admin, current.branch_id), to: await branchName(admin, branchId) };
  if (tech && v.role === "technician") {
    if (v.teamCode && tech.team_code !== v.teamCode.toUpperCase()) changes.team = { from: tech.team_code, to: v.teamCode.toUpperCase() };
    const skills = parseSkills(v.skills).join(", ");
    if ((tech.skills ?? []).join(", ") !== skills) changes.skills = { from: (tech.skills ?? []).join(", "), to: skills };
  }

  if (Object.keys(changes).length > 0) {
    const action: AuditAction =
      current.active && !v.active
        ? "user_deactivated"
        : !current.active && v.active
          ? "user_reactivated"
          : current.role !== v.role
            ? "role_changed"
            : "user_updated";
    await audit(admin, actor, action, { id: v.id, name: v.fullName, email: current.email }, changes);
  }
  revalidateUserViews();
  return { ok: true };
}

// ---------------------------------------------------------- reset password --

export async function resetPasswordAction(values: ResetPasswordValues): Promise<ActionResult> {
  const actor = await requireUser(["admin"]);
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields", fieldErrors: flattenIssues(parsed.error.issues) };
  const admin = createAdminClient();

  const { data: target } = await admin.from("profiles").select("id, full_name, email").eq("id", parsed.data.id).maybeSingle();
  if (!target) return { ok: false, error: "This user no longer exists" };

  const { error } = await admin.auth.admin.updateUserById(target.id, { password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") return { ok: false, error: error.message, fieldErrors: { password: "Too weak" } };
    return { ok: false, error: `Could not reset the password: ${error.message}` };
  }

  await audit(admin, actor, "password_reset", { id: target.id, name: target.full_name, email: target.email });
  revalidateUserViews();
  return { ok: true };
}

// ------------------------------------------------------------- reset 2FA --

/**
 * Lost-phone recovery: removes the user's authenticator so they can sign in with their
 * password and set 2FA up again. Their current sessions keep working; audited as mfa_reset.
 */
export async function resetMfaAction(userId: string): Promise<ActionResult> {
  const actor = await requireUser(["admin"]);
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, full_name, email").eq("id", userId).maybeSingle();
  if (!target) return { ok: false, error: "This user no longer exists" };

  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) return { ok: false, error: `Could not read sign-in methods: ${error.message}` };
  if (!data.factors.length) return { ok: false, error: "Two-factor authentication is already off for this user" };
  for (const f of data.factors) {
    const { error: delError } = await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
    if (delError) return { ok: false, error: `Could not reset two-factor authentication: ${delError.message}` };
  }

  await auditMfa("mfa_reset", { id: actor.id, name: actor.fullName }, { id: target.id, name: target.full_name, email: target.email });
  revalidateUserViews();
  return { ok: true };
}
