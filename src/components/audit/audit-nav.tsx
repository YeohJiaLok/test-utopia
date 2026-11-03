"use client";

import { createContext, useCallback, useContext, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface AuditNav {
  pending: boolean;
  go: (href: string) => void;
}

const Ctx = createContext<AuditNav>({ pending: false, go: () => {} });

/** Shares one navigation transition between the toolbar and the results, so filters feel instant. */
export function AuditNavProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = useCallback((href: string) => startTransition(() => router.push(href, { scroll: false })), [router]);
  const value = useMemo(() => ({ pending, go }), [pending, go]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuditNav() {
  return useContext(Ctx);
}

/** Dims its content while a filter / page navigation is in flight. */
export function PendingFade({ className, children }: { className?: string; children: React.ReactNode }) {
  const { pending } = useAuditNav();
  return (
    <div
      aria-busy={pending}
      className={cn("transition-opacity duration-200", pending && "pointer-events-none opacity-55", className)}
    >
      {children}
    </div>
  );
}
