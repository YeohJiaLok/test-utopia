"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/auth";
import { safeNext } from "@/lib/users";
import type { AppRole } from "@/lib/types";

export interface LoginState {
  error?: string;
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

const BAD_CREDENTIALS = "Incorrect email or password.";
const DEACTIVATED = "This account is deactivated. Contact your administrator.";

/**
 * Credentials sign-in. The portal is decided by the account's role in public.profiles
 * (the source of truth), never by anything the browser sends.
 */
async function signIn(email: string, password: string): Promise<{ error?: string; role?: AppRole }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    // Banned = deactivated by an admin. Everything else gets one generic message, so the
    // response never reveals whether the email exists.
    if (error?.code === "user_banned") return { error: DEACTIVATED };
    if (error?.status === 429) return { error: "Too many attempts. Wait a minute and try again." };
    return { error: BAD_CREDENTIALS };
  }

  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.active) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: profile ? DEACTIVATED : "This account has no access to Sejuk Ops. Contact your administrator." };
  }
  return { role: profile.role as AppRole };
}

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (result.error || !result.role) return { error: result.error };
  redirect(safeNext(parsed.data.next, ROLE_HOME[result.role]));
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
