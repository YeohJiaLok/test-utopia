"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Activity } from "lucide-react";
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

/** Latest order_events across the company, newest first. */
export function ActivityFeed({ items }: { items: FeedItem[] }) {
  return (
    <section className="bg-card rounded-xl border shadow-xs">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <p className="text-muted-foreground text-xs">Live audit trail from workflow actions</p>
        </div>
        <Link href="/audit" className="text-primary text-xs font-medium hover:underline">
          Audit log
        </Link>
      </header>
      {items.length ? (
        <ol className="divide-y">
          {items.map((e, i) => {
            const tone = e.toStatus ? TONE_CLASSES[STATUS_META[e.toStatus].tone].dot : "bg-muted-foreground/40";
            const extra = detail(e);
            return (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: EASE, delay: 0.1 + i * 0.035 }}
                className="flex gap-3 px-4 py-2.5"
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", tone)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{EVENT_LABELS[e.action] ?? e.action.replace(/_/g, " ")}</span>{" "}
                    {e.orderNo && (
                      <Link href={`/admin/orders/${e.orderId}`} className="text-primary font-mono text-xs font-semibold hover:underline">
                        {e.orderNo}
                      </Link>
                    )}
                    {extra && <span className="text-muted-foreground"> {extra}</span>}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {e.actorName ?? "System"}
                    {e.customerName ? ` · ${e.customerName}` : ""}
                  </p>
                </div>
                <time className="text-muted-foreground shrink-0 text-[11px] tabular" dateTime={e.createdAt} title={formatDateTime(e.createdAt)} suppressHydrationWarning>
                  {formatRelative(e.createdAt)}
                </time>
              </motion.li>
            );
          })}
        </ol>
      ) : (
        <div className="p-4">
          <EmptyState icon={Activity} title="No activity yet" description="Workflow actions will stream in here." className="py-8" />
        </div>
      )}
    </section>
  );
}
