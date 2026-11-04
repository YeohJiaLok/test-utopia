"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCheck, Loader2, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EASE } from "@/components/motion";
import { formatMYR, formatRelative } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { closeOrders } from "@/app/(app)/manager/actions";
import type { ReadyItem } from "@/app/(app)/manager/reviews/_lib/workspace";
import { Stars } from "./review-tabs";

function PaymentBadge({ item }: { item: ReadyItem }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap";
  if (item.payment === "paid") {
    return (
      <span className={cn(base, "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300")}>
        Paid · {PAYMENT_METHOD_LABELS[item.paymentMethod ?? ""]?.replace(/ \(.*\)/, "") ?? "Recorded"}
      </span>
    );
  }
  if (item.payment === "short") {
    return (
      <span className={cn(base, "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300")}>
        Short {formatMYR(item.final - (item.paid ?? 0))}
      </span>
    );
  }
  return <span className={cn(base, "bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-300")}>Not collected</span>;
}

/** Approved jobs waiting to be closed. Bulk close only for fully paid jobs; others close one by one with a warning. */
export function ReadyToClose({ items }: { items: ReadyItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ReadyItem[] | null>(null);
  const [pending, start] = useTransition();
  const eligible = useMemo(() => items.filter((i) => i.payment === "paid"), [items]);
  const allOn = eligible.length > 0 && eligible.every((i) => selected.has(i.id));
  const value = items.reduce((s, i) => s + i.final, 0);
  const issues = items.length - eligible.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(list: ReadyItem[]) {
    start(async () => {
      const res = await closeOrders(list.map((i) => i.id));
      if (!res.ok) return void toast.error("Couldn't close", { description: res.error });
      if (res.closed) toast.success(`${res.closed} order${res.closed === 1 ? "" : "s"} closed`, { description: "Finalised and recorded in the audit trail." });
      if (res.failed.length) toast.error(`${res.failed.length} could not be closed`, { description: res.failed[0]!.error });
      setSelected(new Set());
      setConfirm(null);
      router.refresh();
    });
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={CheckCheck}
        className="bg-card py-16"
        title="Nothing waiting to be closed"
        description="Jobs you approve appear here until they're closed. Closing finalises the order."
      />
    );
  }

  const single = confirm?.length === 1 ? confirm[0]! : null;

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          <span className="text-foreground font-medium">{items.length}</span> approved · {formatMYR(value)} ·{" "}
          {issues ? (
            <span className="text-amber-700 dark:text-amber-300">{issues} with payment to check (close individually)</span>
          ) : (
            "all payments collected"
          )}
        </span>
        <label className="flex h-9 cursor-pointer items-center gap-2 font-medium">
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={allOn}
            disabled={!eligible.length}
            onChange={() => setSelected(allOn ? new Set() : new Set(eligible.map((i) => i.id)))}
          />
          Select all paid ({eligible.length})
        </label>
      </div>

      <ul className="space-y-2">
        {items.map((i, idx) => {
          const canBulk = i.payment === "paid";
          return (
            <motion.li
              key={i.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE, delay: Math.min(idx, 10) * 0.03 }}
              className={cn(
                "bg-card grid gap-3 rounded-xl border p-3 shadow-xs transition-colors sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-3.5",
                selected.has(i.id) && "border-primary/50 bg-primary/[0.03]",
              )}
            >
              <label
                className={cn("flex items-center gap-3 sm:contents", canBulk ? "cursor-pointer" : "cursor-not-allowed")}
                title={canBulk ? undefined : "Payment needs checking: close this one individually"}
              >
                <input
                  type="checkbox"
                  className="accent-primary size-5 shrink-0 sm:size-4"
                  checked={selected.has(i.id)}
                  disabled={!canBulk}
                  onChange={() => toggle(i.id)}
                  aria-label={`Select ${i.orderNo}`}
                />
                <span className="min-w-0 sm:hidden">
                  <span className="text-primary font-mono text-[13px] font-semibold">{i.orderNo}</span>
                </span>
              </label>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link href={`/manager/orders/${i.id}`} className="text-primary hidden font-mono text-[13px] font-semibold hover:underline sm:inline">
                    {i.orderNo}
                  </Link>
                  <span className="truncate text-sm font-medium">{i.customer}</span>
                  <PaymentBadge item={i} />
                </div>
                <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span>
                    {i.service} · {i.technician}
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">{formatMYR(i.final)}</span>
                  <Stars value={i.rating} />
                  <span suppressHydrationWarning>
                    Approved by {i.approvedBy} {i.reviewedAt ? formatRelative(i.reviewedAt) : ""}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/manager/orders/${i.id}`} className="border-input hover:bg-muted inline-flex h-10 flex-1 items-center justify-center rounded-md border px-3 text-sm font-medium sm:hidden">
                  Open
                </Link>
                <Button variant="outline" className="h-10 flex-1 sm:h-8 sm:flex-none" onClick={() => setConfirm([i])} disabled={pending}>
                  <Lock /> Close
                </Button>
              </div>
            </motion.li>
          );
        })}
      </ul>

      {/* Bulk bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="bg-background/95 fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border p-2.5 pl-4 shadow-2xl backdrop-blur sm:bottom-6 lg:left-[calc(var(--sidebar-width,16rem)+1rem)]"
            role="region"
            aria-label="Bulk actions"
          >
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{selected.size}</span> selected
            </span>
            <Button variant="ghost" size="sm" className="h-10 sm:h-8" onClick={() => setSelected(new Set())}>
              <X /> Clear
            </Button>
            <Button className="h-10 sm:h-8" onClick={() => setConfirm(items.filter((i) => selected.has(i.id)))} disabled={pending}>
              <Lock /> Close selected
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{single ? `Close ${single.orderNo}?` : `Close ${confirm?.length ?? 0} orders?`}</DialogTitle>
            <DialogDescription>
              Closing finalises {single ? "the order" : "these orders"}: no further changes, reassignments or reschedules. Each close is
              recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>
          {single && single.payment !== "paid" && (
            <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span>
                {single.payment === "unpaid"
                  ? `No payment was recorded for this job (final ${formatMYR(single.final)}). Close it only if accounts has collected it.`
                  : `Only ${formatMYR(single.paid ?? 0)} of ${formatMYR(single.final)} was recorded. Close it only if the balance is settled.`}
              </span>
            </div>
          )}
          {!single && confirm && (
            <p className="text-muted-foreground text-sm">
              Total value <span className="text-foreground font-semibold">{formatMYR(confirm.reduce((s, i) => s + i.final, 0))}</span>, all
              fully paid.
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={() => confirm && run(confirm)} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Lock />}
              {single ? "Close order" : `Close ${confirm?.length ?? 0} orders`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
