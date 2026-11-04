"use client";

import { motion } from "motion/react";
import { Check, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CANCEL_REASON_LABELS, ORDER_STATUSES, STATUS_META, statusIndex } from "@/lib/workflow";
import type { OrderStatus } from "@/lib/types";
import { EASE } from "@/components/motion";

export interface CancellationInfo {
  at: string | null;
  reason: string | null;
  note: string | null;
  by?: string | null;
}

/**
 * Animated lifecycle tracker: New → Assigned → In Progress → Job Done → Reviewed → Closed.
 * A cancelled order shows a cancellation panel (reason, note, when, who) instead.
 */
export function StatusPipeline({
  status,
  timestamps,
  compact,
  className,
  cancellation,
}: {
  status: OrderStatus;
  timestamps?: Partial<Record<OrderStatus, string | null>>;
  compact?: boolean;
  className?: string;
  cancellation?: CancellationInfo;
}) {
  if (status === "cancelled") return <CancelledPanel info={cancellation} className={className} />;
  const current = statusIndex(status);
  const progress = current / (ORDER_STATUSES.length - 1);

  return (
    <div className={cn("relative", className)}>
      <div className="absolute top-3.5 right-[8.33%] left-[8.33%] h-0.5 rounded-full bg-border" />
      <motion.div
        className="bg-gradient-brand absolute top-3.5 left-[8.33%] h-0.5 origin-left rounded-full"
        style={{ width: "83.34%" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: progress }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
      />
      <ol className="relative grid grid-cols-6">
        {ORDER_STATUSES.map((s, i) => {
          const done = i < current;
          const active = i === current;
          // Rework is shown on the In Progress step: the work is being redone.
          const rework = active && status === "rework";
          const meta = STATUS_META[rework ? "rework" : s];
          return (
            <li key={s} className="flex flex-col items-center gap-1.5 text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.08 * i, duration: 0.35, ease: EASE }}
                className={cn(
                  "relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors",
                  done && "border-transparent bg-primary text-primary-foreground",
                  active && !rework && "animate-pulse-ring border-primary bg-background text-primary",
                  rework && "border-orange-500 bg-background text-orange-600 dark:text-orange-400",
                  !done && !active && "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : rework ? <RotateCcw className="size-3.5" strokeWidth={2.5} /> : i + 1}
              </motion.span>
              <span
                className={cn(
                  "text-[11px] leading-tight font-medium",
                  rework ? "text-orange-700 dark:text-orange-300" : active ? "text-foreground" : "text-muted-foreground",
                  compact && "hidden sm:block",
                )}
              >
                {/* Short labels on phones ("On site", "Done") so six steps fit without wrapping. */}
                <span className="sm:hidden">{meta.short}</span>
                <span className="hidden sm:inline">{meta.label}</span>
              </span>
              {/* Later steps show no time (a job sent back for rework keeps its old Job Done time). */}
              {!compact && i <= current && timestamps?.[s] && (
                <span className="text-muted-foreground hidden text-[10px] tabular-nums md:block">
                  {new Date(timestamps[s]!).toLocaleString("en-MY", {
                    timeZone: "Asia/Kuala_Lumpur",
                    day: "2-digit",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CancelledPanel({ info, className }: { info?: CancellationInfo; className?: string }) {
  const reason = info?.reason ? (CANCEL_REASON_LABELS[info.reason] ?? info.reason) : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={cn("flex items-start gap-3", className)}
      role="status"
    >
      <motion.span
        initial={{ scale: 0.6, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 16 }}
        className="bg-destructive/10 text-destructive flex size-10 shrink-0 items-center justify-center rounded-full"
      >
        <XCircle className="size-5" />
      </motion.span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">
          Order cancelled{reason && <span className="text-muted-foreground font-normal"> · {reason}</span>}
        </p>
        {info?.note && <p className="mt-0.5 break-words">“{info.note}”</p>}
        {(info?.at || info?.by) && (
          <p className="text-muted-foreground mt-1 text-xs tabular">
            {info.at &&
              new Date(info.at).toLocaleString("en-MY", {
                timeZone: "Asia/Kuala_Lumpur",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            {info.by && ` · by ${info.by}`}
          </p>
        )}
      </div>
    </motion.div>
  );
}
