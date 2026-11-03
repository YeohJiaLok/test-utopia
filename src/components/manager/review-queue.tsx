"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Camera, ClipboardCheck, Clock, Filter, Paperclip, RotateCcw, ShieldAlert, User, Wrench } from "lucide-react";
import { EASE } from "@/components/motion";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form-field";
import { SeverityBadge } from "@/components/shared/status-badge";
import type { QueueItem } from "@/app/(app)/manager/_lib/queries";
import { formatDateTime, formatMYR } from "@/lib/format";
import { cn } from "@/lib/utils";

function waiting(completedAt: string | null, now: number) {
  if (!completedAt) return { label: "—", hours: 0 };
  const mins = Math.max(0, Math.round((now - new Date(completedAt).getTime()) / 60_000));
  const hours = mins / 60;
  if (mins < 60) return { label: `${mins}m`, hours };
  if (hours < 48) return { label: `${Math.floor(hours)}h ${mins % 60}m`, hours };
  return { label: `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h`, hours };
}

export function ReviewQueue({ items, now }: { items: QueueItem[]; now: number }) {
  const [tech, setTech] = useState("all");

  const technicians = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const i of items) {
      const k = i.technicianId ?? "none";
      const cur = map.get(k);
      map.set(k, { name: i.technicianName, count: (cur?.count ?? 0) + 1 });
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [items]);

  const visible = tech === "all" ? items : items.filter((i) => (i.technicianId ?? "none") === tech);

  if (!items.length) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        className="bg-card py-16"
        title="Review queue is clear"
        description="Every completed job has been reviewed. New completions will appear here automatically."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card flex flex-col gap-2 rounded-xl border p-2.5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:pl-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <label htmlFor="queue-tech" className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs font-medium">
            <Filter className="size-3.5" aria-hidden />
            <span className="max-sm:sr-only">Technician</span>
          </label>
          <div className="min-w-0 flex-1 sm:w-60 sm:flex-none">
            <NativeSelect id="queue-tech" value={tech} onChange={(e) => setTech(e.target.value)} className="max-sm:h-11">
              <option value="all">All technicians ({items.length})</option>
              {technicians.map(([id, t]) => (
                <option key={id} value={id}>
                  {t.name} ({t.count})
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <p className="text-muted-foreground px-1 text-xs" aria-live="polite">
          Showing <span className="text-foreground tabular font-medium">{visible.length}</span> of {items.length} · oldest
          completion first
        </p>
      </div>

      <motion.ul layout className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout" initial>
          {visible.map((o, i) => {
            const wait = waiting(o.completedAt, now);
            const pct = o.quoted > 0 ? (o.extra / o.quoted) * 100 : 0;
            return (
              <motion.li
                key={o.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.35, ease: EASE, delay: Math.min(i, 12) * 0.03 }}
              >
                <Link
                  href={`/manager/orders/${o.id}`}
                  className={cn(
                    "group bg-card focus-visible:ring-ring/50 hover:border-primary/30 relative flex h-full flex-col overflow-hidden rounded-xl border p-4 pl-5 shadow-xs transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3",
                    "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-transparent",
                    o.topSeverity === "high" && "border-red-500/25 before:bg-red-500",
                    o.topSeverity === "medium" && "before:bg-amber-500",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-muted-foreground group-hover:text-primary font-mono text-xs font-semibold tracking-tight transition-colors">
                        {o.orderNo}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold">{o.customerName}</p>
                    </div>
                    <span
                      className={cn(
                        "tabular inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                        wait.hours >= 48
                          ? "bg-red-500/10 text-red-700 dark:text-red-300"
                          : wait.hours >= 24
                            ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                            : "bg-muted text-muted-foreground",
                      )}
                      title={`Completed ${formatDateTime(o.completedAt)}`}
                    >
                      <Clock className="size-3" aria-hidden />
                      <span className="sr-only">Waiting </span>
                      {wait.label}
                    </span>
                  </div>

                  <dl className="text-muted-foreground mt-3 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Wrench className="size-3.5 shrink-0" aria-hidden />
                      <dt className="sr-only">Service</dt>
                      <dd className="truncate">{o.serviceName}</dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="size-3.5 shrink-0" aria-hidden />
                      <dt className="sr-only">Technician</dt>
                      <dd className="truncate">
                        {o.technicianName}
                        {o.branchName ? ` · ${o.branchName}` : ""}
                      </dd>
                    </div>
                  </dl>

                  <div className="bg-muted/50 ring-foreground/[0.04] mt-3 flex items-end justify-between gap-2 rounded-lg px-3 py-2 ring-1 ring-inset">
                    <div>
                      <p className="text-muted-foreground text-[11px]">Final</p>
                      <p className="tabular text-base font-semibold">{formatMYR(o.final)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground tabular text-[11px]">Quoted {formatMYR(o.quoted)}</p>
                      {o.extra > 0 ? (
                        <span
                          className={cn(
                            "tabular mt-0.5 inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                            pct >= 50 ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                          )}
                        >
                          +{formatMYR(o.extra)} ({pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="text-muted-foreground mt-0.5 inline-flex text-[11px]">No extras</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                    <span className={cn("inline-flex items-center gap-1", o.photoCount === 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                      <Camera className="size-3.5" aria-hidden />
                      {o.photoCount} photo{o.photoCount === 1 ? "" : "s"}
                    </span>
                    {o.fileCount > o.photoCount && (
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <Paperclip className="size-3.5" aria-hidden />
                        {o.fileCount - o.photoCount} other
                      </span>
                    )}
                    {o.reworked && (
                      <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-300">
                        <RotateCcw className="size-3.5" aria-hidden /> Resubmitted
                      </span>
                    )}
                    {o.openFlags > 0 && o.topSeverity ? (
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                        <span className="text-muted-foreground">
                          {o.openFlags} flag{o.openFlags === 1 ? "" : "s"}
                        </span>
                        <SeverityBadge severity={o.topSeverity} />
                      </span>
                    ) : null}
                  </div>

                  <span className="mt-auto pt-3">
                    <span className="text-primary flex items-center justify-between gap-1 border-t pt-3 text-xs font-medium">
                      Review job
                      <span className="bg-primary/8 group-hover:bg-primary group-hover:text-primary-foreground flex size-7 items-center justify-center rounded-full transition-colors">
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </span>
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}
