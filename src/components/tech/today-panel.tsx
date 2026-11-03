"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { CalendarDays, Check, ChevronRight } from "lucide-react";
import { EASE } from "@/components/motion";
import { TONE_CLASSES } from "@/components/shared/status-badge";
import { formatMYR, formatTime } from "@/lib/format";
import { STATUS_META } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import type { TechJob } from "@/app/(app)/tech/queries";
import { scheduleLabel } from "./lib";

function ProgressRing({ value }: { value: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 72 72" className="size-[72px] shrink-0 -rotate-90" aria-hidden>
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
      <motion.circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        className="stroke-primary"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - value) }}
        transition={{ duration: 1, ease: EASE, delay: 0.2 }}
      />
    </svg>
  );
}

/** Desktop side panel on the jobs board: today's progress, schedule timeline and what's coming up. */
export function TodayPanel({
  active,
  upcoming,
  doneToday,
  collectedToday,
  className,
}: {
  active: TechJob[];
  upcoming: TechJob[];
  doneToday: TechJob[];
  collectedToday: number;
  className?: string;
}) {
  const total = active.length + doneToday.length;
  const ratio = total ? doneToday.length / total : 0;
  const schedule = [
    ...doneToday.map((j) => ({
      job: j,
      at: j.completion?.completed_at ?? j.completed_at ?? j.scheduled_at,
      done: true,
    })),
    ...active.map((j) => ({ job: j, at: j.scheduled_at, done: false })),
  ].sort((a, b) => (a.at ?? "9").localeCompare(b.at ?? "9"));

  return (
    <aside className={cn("space-y-4 lg:sticky lg:top-20 lg:self-start", className)}>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
        className="bg-card rounded-2xl border p-5 shadow-xs"
      >
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Today&apos;s progress</p>
        <div className="mt-3 flex items-center gap-4">
          <div className="relative">
            <ProgressRing value={ratio} />
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
              {Math.round(ratio * 100)}%
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold tabular-nums">
              {doneToday.length} of {total} jobs done
            </p>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium tabular-nums">{formatMYR(collectedToday)}</span> collected on site
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.18 }}
        className="bg-card rounded-2xl border p-5 shadow-xs"
      >
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Today&apos;s route</p>
        {schedule.length ? (
          <ol className="mt-3">
            {schedule.map(({ job, at, done }, i) => {
              const tone = TONE_CLASSES[STATUS_META[job.status].tone];
              return (
                <li key={job.id} className="relative flex gap-3">
                  {i < schedule.length - 1 && <span className="bg-border absolute top-7 bottom-0 left-[11px] w-px" aria-hidden />}
                  <span
                    className={cn(
                      "relative mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-card ring-4",
                      done ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" strokeWidth={3} />
                    ) : (
                      <span className={cn("size-2 rounded-full", tone.dot)} />
                    )}
                  </span>
                  <Link
                    href={`/tech/jobs/${job.id}`}
                    className="hover:bg-muted/60 -mr-2 mb-1 flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn("truncate text-sm font-medium", done && "text-muted-foreground line-through decoration-1")}
                      >
                        {job.customer_name}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        <span className="tabular-nums">
                          {done ? `Done ${formatTime(at)}` : at ? formatTime(at) : "Unscheduled"}
                        </span>{" "}
                        · {job.service_type?.name ?? "Aircon service"}
                      </p>
                    </div>
                    <ChevronRight className="text-muted-foreground/50 size-4 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">No jobs on today&apos;s route.</p>
        )}
      </motion.section>

      {upcoming.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.26 }}
          className="bg-card rounded-2xl border p-5 shadow-xs"
        >
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Coming up</p>
          <ul className="mt-2 divide-y">
            {upcoming.slice(0, 4).map((job) => (
              <li key={job.id}>
                <Link
                  href={`/tech/jobs/${job.id}`}
                  className="hover:text-primary flex items-center gap-3 py-2.5 transition-colors"
                >
                  <span className="bg-accent text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <CalendarDays className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{job.customer_name}</p>
                    <p className="text-muted-foreground truncate text-xs tabular-nums">{scheduleLabel(job.scheduled_at)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {upcoming.length > 4 && <p className="text-muted-foreground mt-1 text-xs">+{upcoming.length - 4} more</p>}
        </motion.section>
      )}
    </aside>
  );
}
