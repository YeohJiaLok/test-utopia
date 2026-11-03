import { cn } from "@/lib/utils";
import { STATUS_META, type StatusTone } from "@/lib/workflow";
import type { FlagSeverity, OrderStatus } from "@/lib/types";

export const TONE_CLASSES: Record<StatusTone, { badge: string; dot: string }> = {
  slate: { badge: "bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300", dot: "bg-slate-400" },
  blue: { badge: "bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-300", dot: "bg-blue-500" },
  amber: { badge: "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300", dot: "bg-amber-500" },
  violet: { badge: "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300", dot: "bg-violet-500" },
  teal: { badge: "bg-teal-500/10 text-teal-700 ring-teal-500/20 dark:text-teal-300", dot: "bg-teal-500" },
  green: { badge: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300", dot: "bg-emerald-500" },
  red: { badge: "bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-300", dot: "bg-red-500" },
};

export function StatusBadge({ status, className, pulse }: { status: OrderStatus; className?: string; pulse?: boolean }) {
  const meta = STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  const live = pulse ?? status === "in_progress";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        tone.badge,
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {live && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", tone.dot)} />}
        <span className={cn("relative inline-flex size-1.5 rounded-full", tone.dot)} />
      </span>
      {meta.label}
    </span>
  );
}

const SEVERITY: Record<FlagSeverity, { label: string; tone: StatusTone }> = {
  high: { label: "High", tone: "red" },
  medium: { label: "Medium", tone: "amber" },
  low: { label: "Low", tone: "slate" },
};

export function SeverityBadge({ severity, className }: { severity: FlagSeverity; className?: string }) {
  const meta = SEVERITY[severity];
  const tone = TONE_CLASSES[meta.tone];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        tone.badge,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {meta.label}
    </span>
  );
}
