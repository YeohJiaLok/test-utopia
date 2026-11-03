"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CalendarClock, CheckCheck, Clock, Loader2, MapPin, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { EASE } from "@/components/motion";
import { formatDateTime, formatMYR, formatRelative } from "@/lib/format";
import type { TechnicianWithLoad } from "@/lib/data/reference";
import type { OrderWithRelations } from "@/lib/types";
import { assignTechnicianAction } from "@/app/(app)/admin/actions";
import { TechnicianPicker, recommendTechnician } from "./technician-picker";

function hoursSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

function QueueRow({ order, technicians, index }: { order: OrderWithRelations; technicians: TechnicianWithLoad[]; index: number }) {
  const [techId, setTechId] = useState<string | null>(() => recommendTechnician(technicians, order.branch_id)?.id ?? null);
  const [pending, startTransition] = useTransition();
  const ageHours = hoursSince(order.created_at);

  function assign() {
    if (!techId) return;
    startTransition(async () => {
      const res = await assignTechnicianAction(order.id, techId);
      if (res.ok) toast.success(`${order.order_no} assigned to ${res.data.technicianName}`, { description: "WhatsApp job card is ready in the outbox." });
      else toast.error("Couldn't assign technician", { description: res.error });
    });
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE, delay: index * 0.05 } }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.25 } }}
      className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)_auto] md:items-center md:py-3.5"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link href={`/admin/orders/${order.id}`} className="text-primary font-mono text-[13px] font-semibold hover:underline">
            {order.order_no}
          </Link>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="truncate text-sm font-medium">{order.customer_name}</span>
          {ageHours >= 4 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-1.5 py-px text-[10px] font-semibold text-amber-700 ring-1 ring-amber-500/20 ring-inset dark:text-amber-300">
              <Clock className="size-2.5" /> Waiting {Math.floor(ageHours)}h
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-xs" suppressHydrationWarning>
          {order.service_type?.name ?? "Service"} · <span className="tabular">{formatMYR(order.quoted_price)}</span> · created{" "}
          {formatRelative(order.created_at)}
        </p>
        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{order.customer_address}</span>
          </span>
          {order.scheduled_at && (
            <span className="inline-flex items-center gap-1 tabular">
              <CalendarClock className="size-3" />
              {formatDateTime(order.scheduled_at)}
            </span>
          )}
        </p>
      </div>
      <TechnicianPicker
        technicians={technicians}
        value={techId}
        onChange={setTechId}
        preferBranchId={order.branch_id}
        size="sm"
        disabled={pending}
        className="h-11 md:h-8"
      />
      <Button onClick={assign} disabled={!techId || pending} className="h-11 md:h-8 md:w-24">
        {pending ? <Loader2 className="animate-spin" /> : <UserCheck />}
        Assign
      </Button>
    </motion.li>
  );
}

/** "Needs assignment" queue with inline quick-assign. Rows animate out once dispatched. */
export function DispatchQueue({ orders, technicians, total }: { orders: OrderWithRelations[]; technicians: TechnicianWithLoad[]; total: number }) {
  return (
    <section className="bg-card rounded-xl border shadow-xs">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Needs assignment
            {total > 0 && (
              <span className="rounded-full bg-amber-500/12 px-1.5 text-[11px] font-semibold text-amber-700 tabular dark:text-amber-300">
                {total}
              </span>
            )}
          </h2>
          <p className="text-muted-foreground text-xs">Oldest first · least-loaded technician pre-selected</p>
        </div>
        {total > orders.length && (
          <Link
            href="/admin/orders?status=new"
            className="text-primary -my-1 inline-flex h-8 shrink-0 items-center gap-0.5 rounded-md px-2 text-xs font-medium hover:underline"
          >
            View all <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </header>
      {orders.length ? (
        <ul className="divide-y">
          <AnimatePresence initial={false}>
            {orders.map((o, i) => (
              <QueueRow key={o.id} order={o} technicians={technicians} index={i} />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="p-4">
          <EmptyState
            icon={CheckCheck}
            title="Every order has a technician"
            description="New orders without an assignment will appear here for dispatch."
            className="py-8"
          />
        </div>
      )}
    </section>
  );
}
