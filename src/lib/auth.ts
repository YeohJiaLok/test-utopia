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

/**
 * Data Access Layer: resolves the verified user (JWT claims) and their profile.
 * Memoised per request so layouts and pages share one lookup.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, branch_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  let technicianId: string | null = null;
  if (profile.role === "technician") {
    const { data: tech } = await supabase.from("technicians").select("id").eq("profile_id", userId).maybeSingle();
    technicianId = tech?.id ?? null;
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as AppRole,
    branchId: profile.branch_id,
    technicianId,
  };
});

/** Use at the top of every protected page / server action. */
export async function requireUser(roles?: AppRole[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
