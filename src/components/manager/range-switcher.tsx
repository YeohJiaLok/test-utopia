"use client";

import { createContext, useContext, useOptimistic, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RangeCtx {
  pending: boolean;
  value: string;
  select: (key: string) => void;
}

const Ctx = createContext<RangeCtx | null>(null);

/**
 * Owns the range navigation transition so the whole dashboard can hold its previous
 * render (dimmed) while the next range loads — no skeleton flash, no layout jump.
 */
export function RangeProvider({ value, children }: { value: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(value);

  const select = (key: string) => {
    if (key === optimistic) return;
    const next = new URLSearchParams(params.toString());
    next.set("range", key);
    startTransition(() => {
      setOptimistic(key);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  return <Ctx.Provider value={{ pending, value: optimistic, select }}>{children}</Ctx.Provider>;
}

function useRange() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("RangeSwitcher must be used inside <RangeProvider>");
  return ctx;
}

/** Animated segmented control (a sliding pill marks the active range). */
export function RangeSwitcher({ options, className }: { options: { value: string; label: string }[]; className?: string }) {
  const { value, select, pending } = useRange();
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <div
        role="radiogroup"
        aria-label="Reporting period"
        className="bg-muted/80 scrollbar-thin flex min-w-0 max-w-full overflow-x-auto rounded-lg border p-0.5"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => select(o.value)}
              className={cn(
                "relative h-8 shrink-0 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="range-pill"
                  className="bg-background absolute inset-0 rounded-md shadow-sm ring-1 ring-foreground/5"
                  transition={{ type: "spring", stiffness: 480, damping: 36 }}
                />
              )}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
      <Loader2
        aria-hidden={!pending}
        className={cn("text-muted-foreground size-4 animate-spin transition-opacity", pending ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}

/** Wraps range-scoped content: dims while the next range is loading. */
export function PendingFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useRange();
  return (
    <div aria-busy={pending} className={cn("transition-opacity duration-300", pending && "pointer-events-none opacity-60", className)}>
      {children}
    </div>
  );
}
