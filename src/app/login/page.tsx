import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { BrandPanel } from "./brand-panel";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>
    </main>
  );
}
