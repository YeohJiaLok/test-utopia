"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, ArrowUpRight, CalendarX2, CheckCheck, MapPin, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { EASE } from "@/components/motion";
import { formatDateTime, formatRelative } from "@/lib/format";
import { telLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { OrderWithRelations } from "@/lib/types";

type Tab = "late" | "unscheduled";

function lateBy(iso: string | null) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${mins} min late`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m late`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} overdue`;
}

function area(address: string) {
  // Last meaningful part of a Malaysian address, e.g. "Shah Alam".
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  return (parts.at(-1) ?? address).replace(/^\d{5}\s*/, "");
}

function Row({ order, tab, index }: { order: OrderWithRelations; tab: Tab; index: number }) {
  const tech = order.technician;
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE, delay: index * 0.04 } }}
      className="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/admin/orders/${order.id}`} className="text-primary font-mono text-[13px] font-semibold hover:underline">
            {order.order_no}
          </Link>
          <span className="truncate text-sm font-medium">{order.customer_name}</span>
          {tab === "late" ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-px text-[10px] font-semibold text-red-700 ring-1 ring-red-500/20 ring-inset dark:text-red-300"
              suppressHydrationWarning
            >
              <AlarmClock className="size-2.5" /> {lateBy(order.scheduled_at)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-1.5 py-px text-[10px] font-semibold text-amber-700 ring-1 ring-amber-500/20 ring-inset dark:text-amber-300">
              <CalendarX2 className="size-2.5" /> No time set
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span>{order.service_type?.name ?? "Service"}</span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{area(order.customer_address)}</span>
          </span>
          {tab === "late" && order.scheduled_at && <span className="tabular">Slot {formatDateTime(order.scheduled_at)}</span>}
          {tab === "unscheduled" && (
            <span suppressHydrationWarning>Booked {formatRelative(order.created_at)}</span>
          )}
        </p>
        {tech && (
          <p className="mt-1 text-xs">
            <span className="text-muted-foreground">Technician </span>
            <span className="font-medium">{tech.name}</span>
            <span className="text-muted-foreground"> · {tech.team_code}</span>
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {tech && (
          <a
            href={telLink(tech.phone)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-11 flex-1 sm:h-8 sm:flex-none")}
            aria-label={`Call ${tech.name}`}
          >
            <Phone /> Call
          </a>
        )}
        <Link
          href={`/admin/orders/${order.id}`}
          className={cn(buttonVariants({ size: "sm" }), "h-11 flex-1 sm:h-8 sm:flex-none")}
        >
          {tab === "late" ? "Follow up" : "Schedule"} <ArrowUpRight />
        </Link>
      </div>
    </motion.li>
  );
}

/**
 * Exceptions a dispatcher should act on: jobs whose slot has passed with nobody on site,
 * and assigned jobs without an agreed visit time. Every order already has a technician.
 */
export function NeedsAttention({
  late,
  lateTotal,
  unscheduled,
  unscheduledTotal,
}: {
  late: OrderWithRelations[];
  lateTotal: number;
  unscheduled: OrderWithRelations[];
  unscheduledTotal: number;
}) {
  const [tab, setTab] = useState<Tab>(lateTotal || !unscheduledTotal ? "late" : "unscheduled");
  const rows = tab === "late" ? late : unscheduled;
  const total = tab === "late" ? lateTotal : unscheduledTotal;
  const all = lateTotal + unscheduledTotal;

  return (
    <section className="bg-card rounded-xl border shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Needs attention
            {all > 0 && (
              <span className="rounded-full bg-red-500/10 px-1.5 text-[11px] font-semibold text-red-700 tabular dark:text-red-300">{all}</span>
            )}
          </h2>
          <p className="text-muted-foreground text-xs">Jobs at risk of a missed visit</p>
        </div>
        <div className="bg-muted inline-flex rounded-lg p-0.5" role="tablist" aria-label="Attention type">
          {(
            [
              ["late", "Running late", lateTotal],
              ["unscheduled", "No time set", unscheduledTotal],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "relative h-9 rounded-md px-3 text-xs font-medium transition-colors sm:h-7",
                tab === key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === key && (
                <motion.span layoutId="attention-tab" className="bg-background absolute inset-0 rounded-md shadow-xs" transition={{ duration: 0.25, ease: EASE }} />
              )}
              <span className="relative">
                {label} <span className="tabular opacity-70">{count}</span>
              </span>
            </button>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {rows.length ? (
            <>
              <ul className="divide-y">
                {rows.map((o, i) => (
                  <Row key={o.id} order={o} tab={tab} index={i} />
                ))}
              </ul>
              {total > rows.length && (
                <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">
                  Showing the {rows.length} oldest of {total}.{" "}
                  <Link href="/admin/orders?status=assigned" className="text-primary font-medium hover:underline">
                    See all assigned orders
                  </Link>
                </p>
              )}
            </>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={CheckCheck}
                title={tab === "late" ? "No one is running late" : "Every job has a visit time"}
                description={
                  tab === "late"
                    ? "Jobs appear here 15 minutes after their slot if the technician hasn't started."
                    : "Assigned jobs without an agreed time appear here."
                }
                className="py-8"
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
