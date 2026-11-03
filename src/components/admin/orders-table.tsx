"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { CalendarClock, ChevronRight, Sparkles, UserX } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EASE } from "@/components/motion";
import { formatDateTime, formatMYR, formatRelative, initials } from "@/lib/format";
import type { OrderWithRelations } from "@/lib/types";

const MotionRow = motion.create(TableRow);

function Technician({ order }: { order: OrderWithRelations }) {
  if (!order.technician) {
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-500/10 px-2 text-xs font-medium whitespace-nowrap text-amber-700 dark:text-amber-300">
        <UserX className="size-3.5" /> Unassigned
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
        {initials(order.technician.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm">{order.technician.name}</span>
        <span className="text-muted-foreground block text-xs">{order.technician.team_code}</span>
      </span>
    </span>
  );
}

/** Desktop table + mobile cards for a page of orders. Rows link to the order detail. */
export function OrdersTable({ orders }: { orders: OrderWithRelations[] }) {
  const router = useRouter();

  return (
    <>
      <div className="bg-card hidden overflow-hidden rounded-xl border shadow-xs md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-muted-foreground pl-4 text-xs">Order</TableHead>
              <TableHead className="text-muted-foreground text-xs">Customer</TableHead>
              <TableHead className="text-muted-foreground hidden text-xs lg:table-cell">Service</TableHead>
              <TableHead className="text-muted-foreground text-xs">Technician</TableHead>
              <TableHead className="text-muted-foreground hidden text-xs xl:table-cell">Scheduled</TableHead>
              <TableHead className="text-muted-foreground text-right text-xs">Quoted</TableHead>
              <TableHead className="text-muted-foreground pr-4 text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o, i) => {
              const href = `/admin/orders/${o.id}`;
              return (
                <MotionRow
                  key={o.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 15) * 0.02 }}
                  onClick={() => router.push(href)}
                  className="group hover:bg-accent/40 cursor-pointer"
                >
                  <TableCell className="py-3 pl-4">
                    <Link
                      href={href}
                      onClick={(e) => e.stopPropagation()}
                      className="group-hover:text-primary font-mono text-[13px] font-semibold transition-colors focus-visible:underline"
                    >
                      {o.order_no}
                    </Link>
                    <span className="text-muted-foreground flex items-center gap-1 text-xs" suppressHydrationWarning>
                      {formatRelative(o.created_at)}
                      {o.source === "ai_document" && <Sparkles className="size-3 text-violet-500" aria-label="Created via AI import" />}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-56">
                    <span className="block truncate font-medium">{o.customer_name}</span>
                    <span className="text-muted-foreground block text-xs tabular">{o.customer_phone}</span>
                  </TableCell>
                  <TableCell className="hidden max-w-48 lg:table-cell">
                    <span className="block truncate">{o.service_type?.name ?? "—"}</span>
                    <span className="text-muted-foreground block text-xs">{o.branch?.name ?? "—"}</span>
                  </TableCell>
                  <TableCell className="max-w-44">
                    <Technician order={o} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs tabular xl:table-cell">
                    {o.scheduled_at ? formatDateTime(o.scheduled_at) : "Not scheduled"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular">{formatMYR(o.quoted_price)}</TableCell>
                  <TableCell className="pr-4">
                    <span className="flex items-center justify-between gap-2">
                      <StatusBadge status={o.status} />
                      <ChevronRight className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </TableCell>
                </MotionRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-2.5 md:hidden">
        {orders.map((o, i) => (
          <motion.li
            key={o.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 10) * 0.03 }}
          >
            <Link
              href={`/admin/orders/${o.id}`}
              className="bg-card active:bg-muted/50 focus-visible:ring-ring/50 block rounded-xl border p-4 shadow-xs transition-colors outline-none focus-visible:ring-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs font-semibold">
                    {o.order_no}
                    {o.source === "ai_document" && <Sparkles className="size-3 text-violet-500" aria-label="Created via AI import" />}
                  </p>
                  <p className="mt-0.5 truncate text-[15px] font-semibold">{o.customer_name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {o.service_type?.name ?? "Service"}
                    {o.branch?.name ? ` · ${o.branch.name}` : ""}
                  </p>
                </div>
                <StatusBadge status={o.status} className="shrink-0" />
              </div>
              <div className="mt-3 flex items-center text-xs">
                {o.technician ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="bg-primary/10 text-primary flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold">
                      {initials(o.technician.name)}
                    </span>
                    <span className="truncate">{o.technician.name}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                    <UserX className="size-3.5" /> Needs a technician
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs">
                <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1 tabular">
                  <CalendarClock className="size-3.5 shrink-0" />
                  <span className="truncate">{o.scheduled_at ? formatDateTime(o.scheduled_at) : "Not scheduled"}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold tabular">
                  {formatMYR(o.quoted_price)}
                  <ChevronRight className="text-muted-foreground size-4" />
                </span>
              </div>
            </Link>
          </motion.li>
        ))}
      </ul>
    </>
  );
}
