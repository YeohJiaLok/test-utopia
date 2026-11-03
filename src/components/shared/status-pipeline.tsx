"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORDER_STATUSES, STATUS_META, statusIndex } from "@/lib/workflow";
import type { OrderStatus } from "@/lib/types";
import { EASE } from "@/components/motion";

/** Animated lifecycle tracker: New → Assigned → In Progress → Job Done → Reviewed → Closed */
export function StatusPipeline({
  status,
  timestamps,
  compact,
  className,
}: {
  status: OrderStatus;
  timestamps?: Partial<Record<OrderStatus, string | null>>;
  compact?: boolean;
  className?: string;
}) {
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
          return (
            <li key={s} className="flex flex-col items-center gap-1.5 text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.08 * i, duration: 0.35, ease: EASE }}
                className={cn(
                  "relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors",
                  done && "border-transparent bg-primary text-primary-foreground",
                  active && "animate-pulse-ring border-primary bg-background text-primary",
                  !done && !active && "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </motion.span>
              <span
                className={cn(
                  "text-[11px] leading-tight font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                  compact && "hidden sm:block",
                )}
              >
                {STATUS_META[s].label}
              </span>
              {!compact && timestamps?.[s] && (
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
