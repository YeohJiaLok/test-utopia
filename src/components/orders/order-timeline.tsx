"use client";

import { motion } from "motion/react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  Lock,
  PlayCircle,
  RotateCcw,
  UserCheck,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { EASE } from "@/components/motion";
import { EVENT_LABELS } from "@/lib/workflow";
import { formatDateTime, formatMYR, formatRelative } from "@/lib/format";
import type { OrderEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  order_created: { icon: FilePlus2, tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
  technician_assigned: { icon: UserCheck, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-300" },
  technician_reassigned: { icon: UserCog, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-300" },
  job_started: { icon: PlayCircle, tone: "bg-amber-500/12 text-amber-600 dark:text-amber-300" },
  job_completed: { icon: CheckCircle2, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  job_reviewed: { icon: ClipboardCheck, tone: "bg-teal-500/10 text-teal-600 dark:text-teal-300" },
  rework_requested: { icon: RotateCcw, tone: "bg-red-500/10 text-red-600 dark:text-red-300" },
  job_closed: { icon: Lock, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
  job_rescheduled: { icon: CalendarClock, tone: "bg-orange-500/10 text-orange-600 dark:text-orange-300" },
};

function describe(e: OrderEvent): string | null {
  const p = e.payload as Record<string, unknown>;
  switch (e.action) {
    case "technician_assigned":
    case "technician_reassigned":
      return p.technician_name ? `Assigned to ${p.technician_name}` : null;
    case "job_completed":
      return [
        p.final_amount !== undefined ? `Final ${formatMYR(Number(p.final_amount))}` : null,
        p.attachments !== undefined ? `${p.attachments} file(s)` : null,
        p.payment_method ? `Paid via ${String(p.payment_method).replace("_", " ")}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "job_reviewed":
    case "rework_requested":
      return [p.rating ? `${p.rating}★` : null, p.notes ? `“${p.notes}”` : null].filter(Boolean).join(" ");
    case "job_rescheduled":
      return [p.to ? `New slot ${formatDateTime(String(p.to))}` : null, p.reason ? `Reason: ${p.reason}` : null]
        .filter(Boolean)
        .join(" · ");
    case "order_created":
      return p.source === "ai_document" ? "Created from AI document import" : null;
    default:
      return null;
  }
}

/** Audit trail rendered from order_events (append-only, written by workflow functions). */
export function OrderTimeline({ events, className }: { events: OrderEvent[]; className?: string }) {
  if (!events.length) {
    return <p className="text-muted-foreground text-sm">No activity recorded yet.</p>;
  }
  return (
    <ol className={cn("relative space-y-5", className)}>
      <span className="bg-border absolute top-2 bottom-2 left-[15px] w-px" aria-hidden />
      {events.map((e, i) => {
        const meta = ICONS[e.action] ?? ICONS.order_created!;
        const Icon = meta.icon;
        const detail = describe(e);
        return (
          <motion.li
            key={e.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: i * 0.05 }}
            className="relative flex gap-3"
          >
            <span className={cn("ring-background relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4", meta.tone)}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium">{EVENT_LABELS[e.action] ?? e.action}</p>
                <time className="text-muted-foreground text-xs tabular-nums" title={formatDateTime(e.created_at)}>
                  {formatRelative(e.created_at)}
                </time>
              </div>
              <p className="text-muted-foreground text-xs">
                by {e.actor_name ?? "System"}
                {e.actor_role ? ` · ${e.actor_role}` : ""}
              </p>
              {detail && <p className="text-foreground/80 mt-1 text-xs">{detail}</p>}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
