import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginShell } from "../login-shell";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Verify sign-in" };

/**
 * Second sign-in step for accounts with two-factor authentication. Reached after a correct
 * password (or whenever requireUser finds an aal1 session that still needs the code).
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");

  // Same authoritative check as requireUser(), so the two can never disagree and loop.
  const { data: satisfied, error } = await supabase.rpc("mfa_satisfied");
  if (error) throw new Error("Could not verify your sign-in. Refresh to try again.");
  if (satisfied === true) redirect("/");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const { next } = await searchParams;
  return (
    <LoginShell>
      <VerifyForm
        name={profile?.full_name ?? ""}
        email={typeof data.claims.email === "string" ? data.claims.email : ""}
        next={typeof next === "string" ? next : undefined}
      />
    </LoginShell>
  );
}
