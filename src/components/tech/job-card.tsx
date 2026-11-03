import Link from "next/link";
import { AlertTriangle, ChevronRight, Clock, MapPin, Timer, User, Wallet } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMYR, formatTime } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import type { TechJob } from "@/app/(app)/tech/queries";
import { JobQuickActions } from "./contact-actions";
import { countdownLabel, isOverdue, scheduleLabel } from "./lib";

export function JobCard({ job, highlight }: { job: TechJob; highlight?: boolean }) {
  const done = !!job.completion && ["job_done", "reviewed", "closed"].includes(job.status);
  const overdue = job.status === "assigned" && isOverdue(job.scheduled_at);
  const countdown = job.status === "assigned" ? countdownLabel(job.scheduled_at) : null;
  const area = job.branch?.name;

  return (
    <article
      className={cn(
        "bg-card relative flex h-full flex-col overflow-hidden rounded-2xl border shadow-xs transition-shadow hover:shadow-md",
        highlight && "border-primary/30 shadow-primary/10 ring-primary/15 shadow-lg ring-4",
      )}
    >
      {highlight && <div className="bg-gradient-brand absolute inset-x-0 top-0 h-1" aria-hidden />}
      <Link
        href={`/tech/jobs/${job.id}`}
        className="active:bg-muted/60 hover:bg-muted/30 focus-visible:bg-muted/40 block flex-1 p-4 transition-colors outline-none"
        aria-label={`Open job ${job.order_no} for ${job.customer_name}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-muted-foreground font-mono text-xs">{job.order_no}</span>
              {highlight && (
                <span className="bg-primary/10 text-primary inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold tracking-wider uppercase">
                  {job.status === "in_progress" ? "On site now" : "Up next"}
                </span>
              )}
            </div>
            <h3 className="mt-1 truncate text-base font-semibold tracking-tight">{job.service_type?.name ?? "Aircon service"}</h3>
          </div>
          <StatusBadge status={job.status} className="shrink-0" />
        </div>

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center gap-2.5">
            <User className="text-muted-foreground size-4 shrink-0" />
            <dt className="sr-only">Customer</dt>
            <dd className="truncate font-medium">{job.customer_name}</dd>
          </div>
          <div className="flex items-start gap-2.5">
            <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <dt className="sr-only">Address</dt>
            <dd className="text-muted-foreground line-clamp-2 min-w-0 leading-snug">
              {area && <span className="text-foreground font-medium">{area} · </span>}
              {job.customer_address}
            </dd>
          </div>
          <div className="flex items-center gap-2.5">
            {overdue ? (
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            ) : (
              <Clock className="text-muted-foreground size-4 shrink-0" />
            )}
            <dt className="sr-only">Schedule</dt>
            <dd className={cn("min-w-0 truncate tabular-nums", overdue && "font-medium text-amber-700 dark:text-amber-400")}>
              {done ? `Completed ${formatTime(job.completion!.completed_at)}` : scheduleLabel(job.scheduled_at)}
            </dd>
            {countdown && (
              <span
                suppressHydrationWarning
                className={cn(
                  "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold tabular-nums",
                  countdown.late ? "bg-amber-500/12 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary",
                )}
              >
                <Timer className="size-3" />
                {countdown.label}
              </span>
            )}
            <ChevronRight className="text-muted-foreground/60 ml-auto size-4 shrink-0" />
          </div>
        </dl>
      </Link>

      {done ? (
        <div className="bg-muted/40 flex min-h-12 items-center justify-between gap-3 border-t px-4 text-sm">
          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5">
            <Wallet className="size-4 shrink-0" />
            <span className="truncate">
              {job.completion!.payment_method ? PAYMENT_METHOD_LABELS[job.completion!.payment_method] : "Payment not recorded"}
            </span>
          </span>
          <span className="font-semibold tabular-nums">{formatMYR(job.completion!.final_amount)}</span>
        </div>
      ) : (
        <JobQuickActions phone={job.customer_phone} address={job.customer_address} />
      )}
    </article>
  );
}
