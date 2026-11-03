import Link from "next/link";
import { AlertTriangle, ChevronRight, Clock, MapPin, User, Wallet } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMYR, formatTime } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import type { TechJob } from "@/app/(app)/tech/queries";
import { JobQuickActions } from "./contact-actions";
import { isOverdue, scheduleLabel } from "./lib";

export function JobCard({ job, highlight }: { job: TechJob; highlight?: boolean }) {
  const done = !!job.completion && ["job_done", "reviewed", "closed"].includes(job.status);
  const overdue = job.status === "assigned" && isOverdue(job.scheduled_at);
  const area = job.branch?.name;

  return (
    <article
      className={cn(
        "bg-card overflow-hidden rounded-2xl border shadow-xs transition-shadow",
        highlight && "ring-primary/30 shadow-primary/5 shadow-md ring-2",
      )}
    >
      <Link
        href={`/tech/jobs/${job.id}`}
        className="active:bg-muted/60 hover:bg-muted/30 block p-4 transition-colors"
        aria-label={`Open job ${job.order_no}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-xs">{job.order_no}</span>
              {highlight && (
                <span className="text-primary text-[11px] font-semibold tracking-wide uppercase">
                  {job.status === "in_progress" ? "On site now" : "Up next"}
                </span>
              )}
            </div>
            <h3 className="mt-0.5 truncate text-base font-semibold">{job.service_type?.name ?? "Aircon service"}</h3>
          </div>
          <StatusBadge status={job.status} className="shrink-0" />
        </div>

        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <User className="text-muted-foreground size-4 shrink-0" />
            <dt className="sr-only">Customer</dt>
            <dd className="truncate font-medium">{job.customer_name}</dd>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <dt className="sr-only">Address</dt>
            <dd className="text-muted-foreground line-clamp-2 min-w-0">
              {area && <span className="text-foreground font-medium">{area} · </span>}
              {job.customer_address}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            {done ? (
              <Clock className="text-muted-foreground size-4 shrink-0" />
            ) : overdue ? (
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            ) : (
              <Clock className="text-muted-foreground size-4 shrink-0" />
            )}
            <dt className="sr-only">Schedule</dt>
            <dd className={cn("tabular-nums", overdue && "font-medium text-amber-700 dark:text-amber-400")}>
              {done ? `Completed ${formatTime(job.completion!.completed_at)}` : scheduleLabel(job.scheduled_at)}
              {overdue && " · overdue"}
            </dd>
            <ChevronRight className="text-muted-foreground/60 ml-auto size-4 shrink-0" />
          </div>
        </dl>
      </Link>

      {done ? (
        <div className="bg-muted/40 flex min-h-12 items-center justify-between gap-3 border-t px-4 text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Wallet className="size-4" />
            {job.completion!.payment_method ? PAYMENT_METHOD_LABELS[job.completion!.payment_method] : "Payment not recorded"}
          </span>
          <span className="font-semibold tabular-nums">{formatMYR(job.completion!.final_amount)}</span>
        </div>
      ) : (
        <JobQuickActions phone={job.customer_phone} address={job.customer_address} />
      )}
    </article>
  );
}
