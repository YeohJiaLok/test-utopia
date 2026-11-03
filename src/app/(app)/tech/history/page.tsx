import type { Metadata } from "next";
import { FadeIn } from "@/components/motion";
import { HistoryList } from "@/components/tech/history-list";
import { WeekSummary } from "@/components/tech/week-summary";
import { requireUser } from "@/lib/auth";
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

export default async function TechHistoryPage() {
  const user = await requireUser(["technician"]);
  const jobs = await getMyHistory(user.technicianId, HISTORY_DAYS);
  const week = summarise(jobs);

  return (
    <div className="space-y-5">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">Completed jobs from the last {HISTORY_DAYS} days.</p>
      </FadeIn>

      <WeekSummary jobs={week.jobs} billed={week.billed} collected={week.collected} extras={week.extras} />

      <HistoryList jobs={jobs} />
    </div>
  );
}
