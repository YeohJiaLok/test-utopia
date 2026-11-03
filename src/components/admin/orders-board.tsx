"use client";

import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { CalendarClock, UserX } from "lucide-react";
import { TONE_CLASSES } from "@/components/shared/status-badge";
import { EASE } from "@/components/motion";
import { ORDER_STATUSES, STATUS_META } from "@/lib/workflow";
import { formatDayShort, formatMYR, formatTime, initials } from "@/lib/format";
import type { OrderStatus, OrderWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ordersHref, type OrderFilters } from "./orders-url";

/** Kanban view: one column per lifecycle stage; cards glide between columns on refresh. */
export function OrdersBoard({
  columns,
  counts,
  filters,
}: {
  columns: Record<OrderStatus, OrderWithRelations[]>;
  counts: Record<OrderStatus | "all", number>;
  filters: OrderFilters;
}) {
  return (
    <LayoutGroup>
      <div className="scrollbar-thin -mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[min(18rem,82vw)] grid-flow-col gap-3 overflow-x-auto px-4 pb-3 sm:auto-cols-[minmax(17rem,1fr)] lg:mx-0 lg:snap-none lg:scroll-px-0 lg:px-0">
        {ORDER_STATUSES.map((status, ci) => {
          const items = columns[status] ?? [];
          const tone = TONE_CLASSES[STATUS_META[status].tone];
          const more = (counts[status] ?? 0) - items.length;
          return (
            <motion.section
              key={status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: ci * 0.05 }}
              className="bg-muted/40 flex max-h-[calc(100dvh-14rem)] min-h-64 snap-start flex-col rounded-xl border"
              aria-label={`${STATUS_META[status].label} orders`}
            >
              <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cn("size-2 rounded-full", tone.dot)} />
                  {STATUS_META[status].label}
                </span>
                <span className="bg-background text-muted-foreground rounded-full border px-2 text-xs font-semibold tabular">
                  {(counts[status] ?? 0).toLocaleString("en-MY")}
                </span>
              </header>
              <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {items.map((o) => (
                    <motion.div
                      key={o.id}
                      layout
                      layoutId={`board-${o.id}`}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    >
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="bg-card hover:border-primary/40 focus-visible:ring-ring/50 block rounded-lg border p-3 shadow-xs transition-[border-color,box-shadow] outline-none hover:shadow-md focus-visible:ring-3 active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold">{o.order_no}</span>
                          <span className="text-xs font-semibold tabular">{formatMYR(o.quoted_price)}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">{o.customer_name}</p>
                        <p className="text-muted-foreground truncate text-xs">{o.service_type?.name ?? "Service"}</p>
                        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                          {o.technician ? (
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="bg-primary/10 text-primary flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold">
                                {initials(o.technician.name)}
                              </span>
                              <span className="truncate">{o.technician.name}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground inline-flex items-center gap-1">
                              <UserX className="size-3" /> Unassigned
                            </span>
                          )}
                          {o.scheduled_at && (
                            <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 tabular">
                              <CalendarClock className="size-3" />
                              {formatDayShort(o.scheduled_at)} · {formatTime(o.scheduled_at)}
                            </span>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {!items.length && (
                  <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-8 text-center text-xs">Nothing at this stage</p>
                )}
              </div>
              {more > 0 && (
                <Link
                  href={ordersHref(filters, { view: "list", status })}
                  className="text-primary hover:bg-background/60 flex h-11 items-center justify-center rounded-b-xl border-t px-3 text-xs font-medium transition-colors sm:h-9"
                >
                  +{more.toLocaleString("en-MY")} more in list view
                </Link>
              )}
            </motion.section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
