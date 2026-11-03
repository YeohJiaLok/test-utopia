import type { Metadata } from "next";
import { Snowflake } from "lucide-react";
import { AuroraBackground } from "./aurora-background";
import { BrandPanel } from "./brand-panel";
import { LoginForm } from "./login-form";
import { SystemStatus } from "./system-status";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  return (
    // Fixed to the viewport: the login screen never scrolls. Forced dark theme for the immersive look.
    <main className="dark login-autofill fixed inset-0 isolate flex flex-col overflow-hidden bg-[oklch(0.12_0.025_258)] text-white [color-scheme:dark]">
      <AuroraBackground />

      <header className="relative z-10 flex h-16 shrink-0 [@media(max-height:780px)]:h-14 items-center justify-between px-5 sm:px-10">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-300 to-cyan-400 text-slate-950">
            <Snowflake className="size-4.5" strokeWidth={2.4} />
          </span>
          <span className="text-sm font-semibold tracking-tight">Sejuk Ops</span>
          <span className="hidden h-4 w-px bg-white/15 sm:block" />
          <span className="hidden text-xs text-white/45 sm:block">Sejuk Sejuk Service Sdn Bhd</span>
        </div>
        <SystemStatus />
      </header>

      <div className="relative z-10 mx-auto grid min-h-0 w-full max-w-7xl flex-1 items-center gap-12 px-5 sm:px-10 lg:grid-cols-[1.1fr_1fr] xl:gap-20">
        <BrandPanel />
        {/* Card is sized to fit; only on very short screens does this column scroll (internally). */}
        <div className="no-scrollbar flex max-h-full justify-center py-4 lg:justify-end [@media(max-height:600px)]:overflow-y-auto">
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </div>
      </div>

      <footer className="relative z-10 flex h-12 shrink-0 [@media(max-height:780px)]:h-10 items-center justify-between px-5 text-[11px] text-white/30 sm:px-10">
        <span>© {new Date().getFullYear()} Sejuk Sejuk Service Sdn Bhd</span>
        <span className="hidden sm:block">Next.js · Supabase · Claude · v1.0</span>
      </footer>
    </main>
  );
}
