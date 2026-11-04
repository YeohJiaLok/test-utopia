"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { EASE } from "@/components/motion";
import { formatTime } from "@/lib/format";
import { COMPLETED_STATUSES } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import type { OrderWithRelations } from "@/lib/types";

const DOT: Record<string, string> = {
  assigned: "bg-blue-500",
  in_progress: "bg-amber-500 animate-pulse",
  rework: "bg-orange-500 animate-pulse",
  job_done: "bg-violet-500",
  reviewed: "bg-teal-500",
  closed: "bg-emerald-500",
};

function area(address: string) {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  return (parts.at(-1) ?? address).replace(/^\d{5}\s*/, "");
}

/** Today's visits in time order, with a "now" marker and live status. */
export function TodaySchedule({ orders, now }: { orders: OrderWithRelations[]; /** Server render time (ISO), for the "Now" marker. */ now: string }) {
  const done = orders.filter((o) => (COMPLETED_STATUSES as string[]).includes(o.status)).length;
  const pct = orders.length ? Math.round((done / orders.length) * 100) : 0;
  const nowMs = new Date(now).getTime();
  const nowIndex = orders.findIndex((o) => o.scheduled_at && new Date(o.scheduled_at).getTime() > nowMs);

  return (
    <section className="bg-card rounded-xl border shadow-xs">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Today&apos;s schedule</h2>
          <p className="text-muted-foreground text-xs">
            {orders.length ? `${done} of ${orders.length} done` : "No visits today"}
          </p>
        </div>
        {orders.length > 0 && (
          <div className="flex w-32 items-center gap-2 sm:w-44">
            <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
              <motion.div
                className="bg-gradient-brand h-full origin-left rounded-full"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: pct / 100 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
              />
            </div>
            <span className="text-muted-foreground w-9 text-right text-xs tabular">{pct}%</span>
          </div>
        )}
      </header>

      {orders.length ? (
        <ol className="relative max-h-[30rem] overflow-y-auto py-2">
          <span className="bg-border absolute top-4 bottom-4 left-[5.6rem] w-px" aria-hidden />
          {orders.map((o, i) => (
            <li key={o.id}>
              {i === nowIndex && (
                <div className="relative flex items-center gap-2 py-1 pr-4 pl-[4.3rem]" aria-label="Current time">
                  <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-semibold">Now</span>
                  <span className="bg-primary/40 h-px flex-1" />
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 12) * 0.03 }}
              >
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="hover:bg-muted/50 group relative grid grid-cols-[4.6rem_1rem_minmax(0,1fr)] items-start gap-x-2 px-4 py-2.5 transition-colors"
                >
                  <span className="pt-0.5 text-right text-xs font-medium tabular">{formatTime(o.scheduled_at)}</span>
                  <span className="relative flex justify-center pt-1.5">
                    <span className={cn("ring-card size-2.5 rounded-full ring-4", DOT[o.status] ?? "bg-muted-foreground")} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {o.customer_name}
                          <span className="text-muted-foreground font-normal"> · {area(o.customer_address)}</span>
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          <span className="font-mono">{o.order_no}</span> · {o.service_type?.name ?? "Service"} ·{" "}
                          {o.technician?.name ?? "—"}
                        </span>
                      </span>
                      <StatusBadge status={o.status} className="shrink-0" />
                    </span>
                  </span>
                </Link>
              </motion.div>
            </li>
          ))}
          {nowIndex === -1 && (
            <li className="relative flex items-center gap-2 py-1 pr-4 pl-[4.3rem]" aria-label="Current time">
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-semibold">Now</span>
              <span className="bg-primary/40 h-px flex-1" />
            </li>
          )}
        </ol>
      ) : (
        <div className="p-4">
          <EmptyState icon={CalendarDays} title="No visits scheduled today" description="Jobs booked for today appear here in time order." className="py-8" />
        </div>
      )}
      {orders.length > 0 && (
        <div className="border-t px-4 py-2.5">
          <Link href="/admin/orders?view=board" className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline">
            Open the dispatch board <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}
