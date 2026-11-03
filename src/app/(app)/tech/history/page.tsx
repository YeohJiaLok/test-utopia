import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { WeekSummary } from "@/components/tech/week-summary";
import { dayLabel, mytDayKey } from "@/components/tech/lib";
import { requireUser } from "@/lib/auth";
import { formatMYR, formatTime } from "@/lib/format";
import { getRange } from "@/lib/time";
import { collectedAmount, getMyHistory, type TechJob } from "../queries";

export const metadata: Metadata = { title: "Job history" };

const HISTORY_DAYS = 60;

function summarise(jobs: TechJob[]) {
  const week = getRange("this_week");
  const from = new Date(week.from).getTime();
  const to = new Date(week.to).getTime();
  const thisWeek = jobs.filter((j) => {
    const t = new Date(j.completion?.completed_at ?? j.completed_at ?? 0).getTime();
    return t >= from && t < to;
  });
  return {
    jobs: thisWeek.length,
    billed: thisWeek.reduce((s, j) => s + (j.completion?.final_amount ?? 0), 0),
    collected: thisWeek.reduce((s, j) => s + collectedAmount(j), 0),
    extras: thisWeek.reduce((s, j) => s + (j.completion?.extra_charges ?? 0), 0),
  };
}

function groupByDay(jobs: TechJob[]) {
  const groups = new Map<string, TechJob[]>();
  for (const j of jobs) {
    const at = j.completion?.completed_at ?? j.completed_at;
    if (!at) continue;
    const key = mytDayKey(at);
    groups.set(key, [...(groups.get(key) ?? []), j]);
  }
  return [...groups.entries()].map(([key, items]) => ({
    key,
    label: dayLabel(key),
    items,
    total: items.reduce((s, j) => s + (j.completion?.final_amount ?? 0), 0),
  }));
}

export default async function TechHistoryPage() {
  const user = await requireUser(["technician"]);
  const jobs = await getMyHistory(user.technicianId, HISTORY_DAYS);
  const week = summarise(jobs);
  const days = groupByDay(jobs);

  return (
    <div className="space-y-5">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">Completed jobs from the last {HISTORY_DAYS} days.</p>
      </FadeIn>

      <WeekSummary jobs={week.jobs} billed={week.billed} collected={week.collected} extras={week.extras} />

      {days.length === 0 ? (
        <EmptyState
          icon={History}
          title="No completed jobs yet"
          description="Jobs you mark as done will be listed here with their final amounts."
          className="bg-card/50"
        />
      ) : (
        <Stagger className="space-y-5" step={0.05} delay={0.1}>
          {days.map((day) => (
            <StaggerItem key={day.key}>
              <section>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-semibold">{day.label}</h2>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {day.items.length} job{day.items.length === 1 ? "" : "s"} · {formatMYR(day.total)}
                  </span>
                </div>
                <ul className="bg-card divide-y overflow-hidden rounded-2xl border shadow-xs">
                  {day.items.map((j) => (
                    <li key={j.id}>
                      <Link
                        href={`/tech/jobs/${j.id}`}
                        className="hover:bg-muted/40 active:bg-muted/60 flex min-h-16 items-center gap-3 px-4 py-3 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{j.service_type?.name ?? "Aircon service"}</p>
                          <p className="text-muted-foreground truncate text-xs">
                            <span className="font-mono">{j.order_no}</span> · {j.customer_name} ·{" "}
                            {formatTime(j.completion?.completed_at ?? j.completed_at)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-semibold tabular-nums">
                            {j.completion ? formatMYR(j.completion.final_amount) : "—"}
                          </span>
                          <StatusBadge status={j.status} className="h-5 px-2 text-[11px]" />
                        </div>
                        <ChevronRight className="text-muted-foreground/60 size-4 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

