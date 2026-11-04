import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { LoginShell } from "./login-shell";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next, reason } = await searchParams;
  const notice = reason === "deactivated" ? "This account is deactivated. Contact your administrator." : undefined;
  return (
    <LoginShell>
      <LoginForm next={typeof next === "string" ? next : undefined} notice={notice} />
    </LoginShell>
  );
}
