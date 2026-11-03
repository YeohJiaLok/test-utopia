"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { EASE } from "@/components/motion";
import { TONE_CLASSES } from "@/components/shared/status-badge";
import { ORDER_STATUSES, STATUS_META } from "@/lib/workflow";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Stacked bar + legend of orders per lifecycle status (kpi_status_counts). */
export function StatusDistribution({ counts }: { counts: Record<OrderStatus, number> }) {
  const total = ORDER_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  return (
    <section className="bg-card rounded-xl border shadow-xs">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Status distribution</h2>
        <p className="text-muted-foreground text-xs">
          <span className="tabular">{total.toLocaleString("en-MY")}</span> orders across the lifecycle
        </p>
      </header>
      <div className="space-y-4 p-4">
        <div className="bg-muted flex h-2.5 overflow-hidden rounded-full" aria-hidden>
          {ORDER_STATUSES.map((s, i) => {
            const pct = total ? ((counts[s] ?? 0) / total) * 100 : 0;
            return (
              <motion.span
                key={s}
                className={cn("h-full", TONE_CLASSES[STATUS_META[s].tone].dot)}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.05 }}
              />
            );
          })}
        </div>
        <ul className="space-y-1">
          {ORDER_STATUSES.map((s) => {
            const n = counts[s] ?? 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <li key={s}>
                <Link
                  href={`/admin/orders?status=${s}`}
                  className="hover:bg-muted/60 -mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors"
                >
                  <span className={cn("size-2 shrink-0 rounded-full", TONE_CLASSES[STATUS_META[s].tone].dot)} />
                  <span className="flex-1">{STATUS_META[s].label}</span>
                  <span className="text-muted-foreground w-10 text-right text-xs tabular">{pct}%</span>
                  <span className="w-10 text-right font-medium tabular">{n.toLocaleString("en-MY")}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
