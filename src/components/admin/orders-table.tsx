"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { CalendarClock, ChevronRight, Sparkles, UserX } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EASE } from "@/components/motion";
import { formatDateTime, formatMYR, formatRelative } from "@/lib/format";
import type { OrderWithRelations } from "@/lib/types";

const MotionRow = motion.create(TableRow);

function Technician({ order }: { order: OrderWithRelations }) {
  if (!order.technician) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <UserX className="size-3.5" /> Unassigned
      </span>
    );
  }
  return (
    <span className="min-w-0">
      <span className="block truncate text-sm">{order.technician.name}</span>
      <span className="text-muted-foreground block text-xs">{order.technician.team_code}</span>
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
                  className="group cursor-pointer"
                >
                  <TableCell className="py-3 pl-4">
                    <Link
                      href={href}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-[13px] font-semibold group-hover:underline focus-visible:underline"
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
              className="bg-card active:bg-muted/50 block rounded-xl border p-3.5 shadow-xs transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] font-semibold">{o.order_no}</p>
                  <p className="truncate text-sm font-medium">{o.customer_name}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <p className="text-muted-foreground mt-1 truncate text-xs">
                {o.service_type?.name ?? "Service"} · {o.technician?.name ?? "Unassigned"}
              </p>
              <div className="mt-2.5 flex items-center justify-between border-t pt-2.5 text-xs">
                <span className="text-muted-foreground inline-flex items-center gap-1 tabular">
                  <CalendarClock className="size-3.5" />
                  {o.scheduled_at ? formatDateTime(o.scheduled_at) : "Not scheduled"}
                </span>
                <span className="font-semibold tabular">{formatMYR(o.quoted_price)}</span>
              </div>
            </Link>
          </motion.li>
        ))}
      </ul>
    </>
  );
}
