"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Activity, ArrowUpRight } from "lucide-react";
import { EASE } from "@/components/motion";
import { EmptyState } from "@/components/shared/empty-state";
import { TONE_CLASSES } from "@/components/shared/status-badge";
import { EVENT_LABELS, STATUS_META } from "@/lib/workflow";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface FeedItem {
  id: number;
  orderId: string;
  orderNo: string | null;
  customerName: string | null;
  action: string;
  actorName: string | null;
  actorRole: string | null;
  toStatus: OrderStatus | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

function detail(item: FeedItem) {
  const p = item.payload;
  if ((item.action === "technician_assigned" || item.action === "technician_reassigned") && p.technician_name) {
    return `→ ${String(p.technician_name)}`;
  }
  if (item.action === "job_rescheduled" && p.reason) return `“${String(p.reason)}”`;
  if (item.action === "order_created" && p.source === "ai_document") return "via AI document import";
  return null;
}

/** Latest order_events across the company, newest first. The list scrolls inside the card. */
export function ActivityFeed({ items }: { items: FeedItem[] }) {
  return (
    <section className="bg-card flex flex-col rounded-xl border shadow-xs" aria-labelledby="activity-heading">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 id="activity-heading" className="flex items-center gap-2 text-sm font-semibold">
            Recent activity
            {items.length > 0 && (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[11px] font-semibold tabular">{items.length}</span>
            )}
          </h2>
          <p className="text-muted-foreground text-xs">Latest workflow events, newest first</p>
        </div>
        <Link
          href="/audit"
          className="text-primary -my-1 inline-flex h-8 shrink-0 items-center gap-0.5 rounded-md px-2 text-xs font-medium hover:underline"
        >
          Audit log <ArrowUpRight className="size-3.5" />
        </Link>
      </header>
      {items.length ? (
        <div className="relative">
          <ol className="scrollbar-thin max-h-[26rem] overflow-y-auto xl:max-h-[21rem] overscroll-contain py-1" aria-label="Recent workflow events">
            {items.map((e, i) => {
              const tone = e.toStatus ? TONE_CLASSES[STATUS_META[e.toStatus].tone].dot : "bg-muted-foreground/40";
              const extra = detail(e);
              return (
                <motion.li
                  key={e.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, ease: EASE, delay: 0.1 + Math.min(i, 10) * 0.035 }}
                  className="relative flex gap-3 px-4 py-2.5"
                >
                  {/* timeline rail */}
                  {i < items.length - 1 && <span className="bg-border absolute top-6 bottom-0 left-[calc(1rem+3.5px)] w-px" aria-hidden />}
                  <span className={cn("ring-card relative mt-1.5 size-2 shrink-0 rounded-full ring-4", tone)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13px] font-medium">{EVENT_LABELS[e.action] ?? e.action.replace(/_/g, " ")}</p>
                      <time
                        className="text-muted-foreground shrink-0 text-[11px] tabular"
                        dateTime={e.createdAt}
                        title={formatDateTime(e.createdAt)}
                        suppressHydrationWarning
                      >
                        {formatRelative(e.createdAt)}
                      </time>
                    </div>
                    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs">
                      {e.orderNo && (
                        <Link
                          href={`/admin/orders/${e.orderId}`}
                          className="text-primary font-mono font-semibold whitespace-nowrap hover:underline"
                        >
                          {e.orderNo}
                        </Link>
                      )}
                      {extra && <span className="text-muted-foreground min-w-0 truncate">{extra}</span>}
                    </p>
                    <p className="text-muted-foreground truncate text-[11px]">
                      {e.actorName ?? "System"}
                      {e.customerName ? ` · ${e.customerName}` : ""}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
          {/* fade hints that the list scrolls */}
          <div className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-xl bg-gradient-to-t to-transparent" aria-hidden />
        </div>
      ) : (
        <div className="p-4">
          <EmptyState icon={Activity} title="No activity yet" description="Workflow actions will stream in here." className="py-8" />
        </div>
      )}
    </section>
  );
}
