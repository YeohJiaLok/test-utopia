"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { DEMO_PASSWORD } from "@/lib/env";
import { ROLE_HOME } from "@/lib/auth";
import type { AppRole } from "@/lib/types";

export interface LoginState {
  error?: string;
}

const credentials = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(6, "Password is too short"),
  next: z.string().optional(),
});

async function signIn(email: string, password: string): Promise<{ error?: string; role?: AppRole }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: error?.message ?? "Unable to sign in" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account has no operations profile. Run the seed script or contact an admin." };
  }
  return { role: profile.role as AppRole };
}

function safeNext(next: string | undefined, role: AppRole) {
  const home = ROLE_HOME[role];
  if (next && next.startsWith(home)) return next;
  return home;
}

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (result.error || !result.role) return { error: result.error };
  redirect(safeNext(parsed.data.next, result.role));
}

/** One-click demo access — also used by the in-app "Switch role" menu. */
export async function demoLoginAction(key: string): Promise<LoginState> {
  const account = DEMO_ACCOUNTS.find((a) => a.key === key);
  if (!account) return { error: "Unknown demo account" };

  const supabase = await createClient();
  await supabase.auth.signOut();
  const result = await signIn(account.email, DEMO_PASSWORD);
  if (result.error || !result.role) {
    return { error: `${result.error ?? "Sign-in failed"}. Has the database been seeded (npm run db:seed)?` };
  }
  redirect(ROLE_HOME[result.role]);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
