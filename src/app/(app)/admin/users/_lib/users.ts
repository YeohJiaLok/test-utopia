import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/types";

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  active: boolean;
  phone: string;
  branchId: number | null;
  branchName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  /** Has a confirmed authenticator app (two-factor authentication on). */
  mfaEnabled: boolean;
  /** Linked roster entry (technicians only). */
  technician: { id: string; teamCode: string; skills: string[]; openJobs: number } | null;
}

export interface UnlinkedTechnician {
  id: string;
  name: string;
  phone: string;
  branchId: number;
  teamCode: string;
  skills: string[];
}

const OPEN = ["assigned", "in_progress"];

/** Every account with role, status, branch, last sign-in and (for technicians) open jobs. */
export async function getUsers(): Promise<UserRow[]> {
  const supabase = await createClient();
  const [profiles, techs, open, lastSignIn, mfa] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, active, phone, branch_id, created_at, branch:branches(name)")
      .order("full_name"),
    supabase.from("technicians").select("id, profile_id, team_code, skills").not("profile_id", "is", null),
    supabase.from("orders").select("assigned_technician_id").in("status", OPEN),
    getLastSignIns(),
    // Users with 2FA on (admin-only function over auth.mfa_factors).
    supabase.rpc("mfa_enrolled_users").then((r) => new Set((r.data ?? []) as string[])),
  ]);
  if (profiles.error) throw new Error(`Could not load users: ${profiles.error.message}`);

  const jobs = new Map<string, number>();
  for (const o of open.data ?? []) {
    if (o.assigned_technician_id) jobs.set(o.assigned_technician_id, (jobs.get(o.assigned_technician_id) ?? 0) + 1);
  }
  const techByProfile = new Map((techs.data ?? []).map((t) => [t.profile_id as string, t]));

  return (profiles.data ?? []).map((p) => {
    const t = techByProfile.get(p.id);
    const branch = (Array.isArray(p.branch) ? p.branch[0] : p.branch) as { name: string } | null;
    return {
      id: p.id,
      fullName: p.full_name,
      email: p.email ?? "",
      role: p.role as AppRole,
      active: p.active,
      phone: p.phone ?? "",
      branchId: p.branch_id,
      branchName: branch?.name ?? null,
      createdAt: p.created_at,
      lastSignInAt: lastSignIn.get(p.id) ?? null,
      mfaEnabled: mfa.has(p.id),
      technician: t ? { id: t.id, teamCode: t.team_code, skills: t.skills ?? [], openJobs: jobs.get(t.id) ?? 0 } : null,
    };
  });
}

/** Roster entries without a login yet: an admin can give one of them an account. */
export async function getUnlinkedTechnicians(): Promise<UnlinkedTechnician[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technicians")
    .select("id, name, phone, branch_id, team_code, skills")
    .is("profile_id", null)
    .eq("active", true)
    .order("name");
  if (error) throw new Error(`Could not load technicians: ${error.message}`);
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, phone: t.phone, branchId: t.branch_id, teamCode: t.team_code, skills: t.skills ?? [] }));
}

/** Last sign-in lives in auth.users, which only the service role can read. */
async function getLastSignIns(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const out = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const u of data.users) if (u.last_sign_in_at) out.set(u.id, u.last_sign_in_at);
    if (data.users.length < 1000) break;
  }
  return out;
}
