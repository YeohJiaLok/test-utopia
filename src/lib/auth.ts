import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, SessionUser } from "@/lib/types";

export const ROLE_HOME: Record<AppRole, string> = {
  admin: "/admin",
  technician: "/tech",
  manager: "/manager",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  technician: "Technician",
  manager: "Manager",
};

/** Signs out and returns to the login page with a notice (src/app/auth/signout/route.ts). */
export const SIGNOUT_DEACTIVATED = "/auth/signout?reason=deactivated";

/** Signed in with a password but two-factor authentication still needs the authenticator code. */
export const MFA_VERIFY_PATH = "/login/verify";

type Session = { status: "none" } | { status: "blocked" } | { status: "mfa" } | { status: "ok"; user: SessionUser };

/**
 * Data Access Layer: resolves the verified user (JWT claims) and their profile.
 * Memoised per request so layouts and pages share one lookup. A signed-in account with no
 * profile, or a deactivated one, is "blocked": it is signed out rather than shown anything.
 * An account with 2FA on whose session hasn't passed the code step (JWT aal1) is "mfa".
 */
const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { status: "none" };

  const [{ data: profile }, mfa] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, branch_id, active").eq("id", userId).maybeSingle(),
    // aal2 already satisfies any 2FA requirement; otherwise ask the database (fails closed).
    claimsData.claims.aal === "aal2" ? Promise.resolve({ data: true, error: null }) : supabase.rpc("mfa_satisfied"),
  ]);
  if (!profile || !profile.active) return { status: "blocked" };
  if (mfa.error) throw new Error("Could not verify your sign-in. Refresh to try again.");
  if (mfa.data !== true) return { status: "mfa" };

  let technicianId: string | null = null;
  if (profile.role === "technician") {
    const { data: tech } = await supabase.from("technicians").select("id").eq("profile_id", userId).maybeSingle();
    technicianId = tech?.id ?? null;
  }

  return {
    status: "ok",
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role as AppRole,
      branchId: profile.branch_id,
      technicianId,
    },
  };
});

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session.status === "ok" ? session.user : null;
}

/** Use at the top of every protected page / server action. */
export async function requireUser(roles?: AppRole[]): Promise<SessionUser> {
  const session = await getSession();
  if (session.status === "none") redirect("/login");
  if (session.status === "blocked") redirect(SIGNOUT_DEACTIVATED);
  if (session.status === "mfa") redirect(MFA_VERIFY_PATH);
  const { user } = session;
  if (roles && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
