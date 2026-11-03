"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { CountUp, EASE } from "@/components/motion";
import { cn } from "@/lib/utils";
import { formatMYR } from "@/lib/format";

export function StatCard({
  label,
  value,
  kind = "number",
  icon: Icon,
  delta,
  hint,
  index = 0,
  invertDelta,
  className,
}: {
  /** When true a rise is bad (e.g. reschedules, open flags) and renders red. */
  invertDelta?: boolean;
  label: string;
  value: number;
  kind?: "number" | "currency" | "percent" | "decimal";
  icon?: LucideIcon;
  /** Percentage change vs previous period, e.g. 12.5 or -4 */
  delta?: number | null;
  hint?: string;
  index?: number;
  className?: string;
}) {
  const format =
    kind === "currency"
      ? (n: number) => formatMYR(n)
      : kind === "percent"
        ? (n: number) => `${n.toFixed(0)}%`
        : kind === "decimal"
          ? (n: number) => n.toFixed(1)
          : (n: number) => Math.round(n).toLocaleString("en-MY");

  const up = (delta ?? 0) >= 0;
  const good = invertDelta ? !up : up;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: index * 0.06 }}
      whileHover={{ y: -2 }}
      className={cn(
        "group bg-card relative overflow-hidden rounded-xl border p-4 shadow-xs transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="bg-gradient-brand pointer-events-none absolute -top-10 -right-10 size-28 rounded-full opacity-[0.07] blur-xl transition-opacity group-hover:opacity-[0.14]" />
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        {Icon && (
          <span className="bg-primary/8 text-primary flex size-8 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        <CountUp value={value} format={format} />
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta !== undefined && delta !== null && Number.isFinite(delta) && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium",
              good ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300",
            )}
          >
            {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground truncate">{hint}</span>}
      </div>
    </motion.div>
  );
}
