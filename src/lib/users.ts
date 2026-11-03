import { z } from "zod";
import type { AppRole } from "@/lib/types";

// User administration rules shared by the admin UI (/admin/users) and its server actions.

/** What each fixed role is for. One source for the role picker and the Roles matrix. */
export const ROLE_INFO: Record<AppRole, { label: string; portal: string; summary: string; scope: string }> = {
  admin: {
    label: "Admin",
    portal: "/admin",
    summary: "Runs operations: creates and dispatches orders, manages users and technicians.",
    scope: "All branches",
  },
  manager: {
    label: "Manager",
    portal: "/manager",
    summary: "Reviews completed jobs, KPI dashboard, AI copilot and supervisor.",
    scope: "All branches",
  },
  technician: {
    label: "Technician",
    portal: "/tech",
    summary: "Mobile job list: starts and completes assigned jobs on site.",
    scope: "Own assigned jobs only",
  },
};

export const ROLES: AppRole[] = ["admin", "manager", "technician"];

/** Capability matrix shown on the Roles tab. Mirrors requireUser() guards, RLS and the workflow functions. */
export const CAPABILITIES: { label: string; roles: AppRole[] }[] = [
  { label: "Create and edit orders", roles: ["admin"] },
  { label: "Assign and reschedule technicians", roles: ["admin"] },
  { label: "WhatsApp outbox", roles: ["admin"] },
  { label: "Start and complete jobs (photos, payment)", roles: ["technician"] },
  { label: "Review and close completed jobs", roles: ["manager"] },
  { label: "KPI dashboard and performance", roles: ["manager", "admin"] },
  { label: "AI copilot and AI supervisor flags", roles: ["manager"] },
  { label: "Audit log", roles: ["manager", "admin"] },
  { label: "Manage users and roles", roles: ["admin"] },
];

export const PASSWORD_MIN = 8;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`)
  .max(72, "At most 72 characters")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letters and at least one number");

/** 0–4, for the strength hint under the password field. */
export function passwordStrength(v: string): { score: number; label: string } {
  let score = 0;
  if (v.length >= PASSWORD_MIN) score++;
  if (v.length >= 12) score++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
  return { score, label: ["Too weak", "Weak", "Fair", "Good", "Strong"][score]! };
}

const phoneSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\+?[\d\s-]{9,15}$/.test(v), "Enter a valid phone number");

const profileFields = {
  fullName: z.string().trim().min(2, "Enter the full name").max(80),
  role: z.enum(["admin", "manager", "technician"]),
  branchId: z.string().min(1, "Choose a branch"),
  phone: phoneSchema,
  // Technician only
  teamCode: z.string().trim().max(12),
  skills: z.string().trim().max(200),
};

export const createUserSchema = z
  .object({
    ...profileFields,
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
    password: passwordSchema,
    confirmPassword: z.string(),
    /** Technician only: link an existing roster entry that has no login yet ("" = create a new one). */
    technicianId: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
  .refine((v) => v.role !== "technician" || v.phone !== "", { path: ["phone"], message: "Technicians need a phone number" })
  .refine((v) => v.role !== "technician" || v.technicianId !== "" || v.teamCode !== "", {
    path: ["teamCode"],
    message: "Enter a team code",
  });

export const updateUserSchema = z
  .object({ id: z.uuid(), ...profileFields, active: z.boolean() })
  .refine((v) => v.role !== "technician" || v.phone !== "", { path: ["phone"], message: "Technicians need a phone number" });

export const resetPasswordSchema = z
  .object({ id: z.uuid(), password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export type CreateUserValues = z.infer<typeof createUserSchema>;
export type UpdateUserValues = z.infer<typeof updateUserSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function parseSkills(v: string): string[] {
  return [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 12);
}

/**
 * Guardrails for a role / status change. Returns the reason it is blocked, or null.
 *  - nobody can demote or deactivate themselves (no accidental lock-out)
 *  - the last active admin stays an active admin
 *  - a technician with open jobs keeps their role and stays active until the jobs are reassigned
 */
export function checkUserChange(input: {
  actorId: string;
  targetId: string;
  current: { role: AppRole; active: boolean };
  next: { role: AppRole; active: boolean };
  activeAdmins: number;
  openJobs: number;
}): string | null {
  const { actorId, targetId, current, next, activeAdmins, openJobs } = input;
  const demoted = current.role === "admin" && next.role !== "admin";
  const deactivated = current.active && !next.active;

  if (actorId === targetId && (demoted || deactivated)) {
    return deactivated ? "You can't deactivate your own account." : "You can't remove your own admin role.";
  }
  if (current.role === "admin" && current.active && (demoted || deactivated) && activeAdmins <= 1) {
    return "This is the last active admin. Make someone else an admin first.";
  }
  if (current.role === "technician" && openJobs > 0 && (next.role !== "technician" || deactivated)) {
    const jobs = `${openJobs} open job${openJobs === 1 ? "" : "s"}`;
    return `This technician has ${jobs}. Reassign ${openJobs === 1 ? "it" : "them"} first.`;
  }
  return null;
}

/** Only follow `next` inside the signed-in user's own portal. */
export function safeNext(next: string | undefined | null, home: string): string {
  if (next && (next === home || next.startsWith(`${home}/`)) && !next.startsWith("//")) return next;
  return home;
}
