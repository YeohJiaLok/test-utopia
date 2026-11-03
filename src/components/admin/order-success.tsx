"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CalendarClock, ClipboardList, FilePlus2, Info, MapPin, Phone, Sparkles, Wrench } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { WhatsAppButton } from "@/components/orders/whatsapp-button";
import { EASE } from "@/components/motion";
import { formatDateTime, formatMYR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CreatedOrderSummary } from "@/app/(app)/admin/actions";

function AnimatedCheck() {
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      className="relative flex size-14 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
    >
      <motion.span
        className="absolute inset-0 rounded-full ring-2 ring-emerald-500/30"
        initial={{ scale: 1, opacity: 0.8 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 }}
      />
      <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: EASE, delay: 0.15 }} />
      </svg>
    </motion.span>
  );
}

function Item({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children}</dd>
    </div>
  );
}

/** Post-submit confirmation: generated order no, full summary and the technician WhatsApp hand-off. */
export function OrderSuccess({ order, onReset }: { order: CreatedOrderSummary; onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="mx-auto max-w-3xl space-y-5"
    >
      <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
        <AnimatedCheck />
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: EASE }}
          className="text-muted-foreground mt-4 text-xs font-semibold tracking-wider uppercase"
        >
          Order created
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.4, ease: EASE }}
          className="mt-1 font-mono text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          {order.orderNo}
        </motion.h2>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm"
        >
          <StatusBadge status={order.status} />
          {order.source === "ai_document" && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-violet-500/10 px-2.5 text-xs font-medium text-violet-700 ring-1 ring-violet-500/20 ring-inset dark:text-violet-300">
              <Sparkles className="size-3" /> From AI document import
            </span>
          )}
          <span className="text-muted-foreground tabular">{formatDateTime(order.createdAt)}</span>
        </motion.div>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.45, ease: EASE }}
        className="bg-card overflow-hidden rounded-xl border shadow-xs"
      >
        <div className="grid gap-px bg-border sm:grid-cols-2">
          <div className="bg-card space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Phone className="text-muted-foreground size-4" /> Customer
            </h3>
            <dl className="space-y-2.5">
              <Item label="Name">{order.customerName}</Item>
              <Item label="Phone">
                <span className="tabular">{order.customerPhone}</span>
              </Item>
              <Item label="Address">
                <span className="inline-flex gap-1">
                  <MapPin className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                  {order.customerAddress}
                </span>
              </Item>
            </dl>
          </div>
          <div className="bg-card space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Wrench className="text-muted-foreground size-4" /> Job
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <Item label="Service" className="col-span-2">
                {order.serviceName}
              </Item>
              <Item label="Quoted price">
                <span className="text-base font-semibold tabular">{formatMYR(order.quotedPrice)}</span>
              </Item>
              <Item label="Branch">{order.branchName ?? "—"}</Item>
              <Item label="Technician">
                {order.technicianName ? (
                  <>
                    {order.technicianName}
                    {order.technicianTeam && <span className="text-muted-foreground"> · {order.technicianTeam}</span>}
                  </>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </Item>
              <Item label="Scheduled">
                <span className="inline-flex items-center gap-1 tabular">
                  <CalendarClock className="text-muted-foreground size-3.5" />
                  {order.scheduledAt ? formatDateTime(order.scheduledAt) : "To be confirmed"}
                </span>
              </Item>
            </dl>
          </div>
          <div className="bg-card space-y-2.5 p-4 sm:col-span-2">
            <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              <Item label="Problem description">{order.problemDescription}</Item>
              <Item label="Admin notes">{order.adminNotes ?? <span className="text-muted-foreground">None</span>}</Item>
            </dl>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.45, ease: EASE }}
      >
        {order.notification && order.technicianName ? (
          <div className="flex flex-col gap-3 rounded-xl border border-[#25D366]/30 bg-[#25D366]/[0.06] p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Job card ready for {order.technicianName}</p>
              <p className="text-muted-foreground text-xs">
                A pre-filled WhatsApp message with the order, customer, address and schedule was generated. Open it to send.
              </p>
            </div>
            <WhatsAppButton href={order.notification.deepLink} notificationId={order.notification.id} size="lg" className="h-10 px-4">
              Notify {order.technicianName.split(/\s+/)[0]} on WhatsApp
            </WhatsAppButton>
          </div>
        ) : (
          <div className="bg-muted/40 flex items-start gap-3 rounded-xl border p-4">
            <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <p className="text-muted-foreground text-sm">
              {order.technicianName
                ? "The technician notification will appear in the WhatsApp outbox shortly."
                : "No technician yet — this order is waiting in the dispatch queue on the Overview page."}
            </p>
          </div>
        )}
      </motion.section>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center"
      >
        <Button variant="outline" onClick={onReset} className="h-10 px-4">
          <FilePlus2 /> Create another order
        </Button>
        {!order.technicianName && (
          <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
            <ClipboardList /> Dispatch queue
          </Link>
        )}
        <Link href={`/admin/orders/${order.id}`} className={cn(buttonVariants(), "h-10 px-4")}>
          View order <ArrowRight />
        </Link>
      </motion.div>
    </motion.div>
  );
}
