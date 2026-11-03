"use client";

import { motion } from "motion/react";
import { CountUp, EASE } from "@/components/motion";
import { cn } from "@/lib/utils";

export interface Metric {
  label: string;
  value: number;
  /** Rendered icon element, e.g. `<Users />` (components can't cross the server/client boundary). */
  icon?: React.ReactNode;
  hint?: string;
  /** Visual emphasis for the value: attention (amber), good (emerald), muted. */
  tone?: "default" | "attention" | "good" | "muted";
}

const TONE: Record<NonNullable<Metric["tone"]>, string> = {
  default: "",
  attention: "text-amber-700 dark:text-amber-300",
  good: "text-emerald-700 dark:text-emerald-300",
  muted: "text-muted-foreground",
};

/**
 * Compact KPI strip: hairline-divided cells in one card. Two columns on phones (an odd
 * last cell spans the row so there is never an empty gap), one row on larger screens.
 */
export function MetricStrip({ items, className }: { items: Metric[]; className?: string }) {
  // One row from the breakpoint where every cell still has room; below it, a 2-up grid.
  const cols =
    items.length >= 5
      ? "lg:grid-cols-5 lg:[&>*:last-child:nth-child(odd)]:col-span-1"
      : items.length === 3
        ? "sm:grid-cols-3 sm:[&>*:last-child:nth-child(odd)]:col-span-1"
        : "sm:grid-cols-4";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={cn(
        "bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border shadow-xs",
        "[&>*:last-child:nth-child(odd)]:col-span-2",
        cols,
        className,
      )}
    >
      {items.map((m) => (
        <div key={m.label} className="bg-card group relative min-w-0 px-4 py-3.5 sm:py-4">
          <div className="flex items-center gap-2">
            {m.icon && (
              <span className="bg-primary/8 text-primary flex size-6 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5">
                {m.icon}
              </span>
            )}
            <p className="text-muted-foreground truncate text-xs font-medium">{m.label}</p>
          </div>
          <p className={cn("mt-2 text-2xl font-semibold tracking-tight", TONE[m.tone ?? "default"])}>
            <CountUp value={m.value} />
          </p>
          {m.hint && <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{m.hint}</p>}
        </div>
      ))}
    </motion.div>
  );
}
