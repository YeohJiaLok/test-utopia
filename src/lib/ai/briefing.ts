/**
 * Pure helpers for the AI operational briefing: percentage maths, a deterministic
 * fallback narrative (used without an API key or when the model fails) and
 * reconciliation that forces model output back onto the computed numbers.
 */
import type { InsightBriefing, InsightStats } from "@/lib/ai/types";

export const OVERLOAD_Z = 1.5;

export function pctChange(current: number, base: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(base) || base === 0) return null;
  return Math.round(((current - base) / base) * 100);
}

function myr(n: number) {
  return `RM${Math.round(n).toLocaleString("en-MY")}`;
}

function changePhrase(pct: number | null, noun: string) {
  if (pct === null) return `${noun} has no comparable baseline from last week`;
  if (pct === 0) return `${noun} is flat on last week`;
  return `${noun} is ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% on the same point last week`;
}

/** A complete, number-accurate briefing built without the model. */
export function buildFallbackBriefing(stats: InsightStats): InsightBriefing {
  const { thisWeek, lastWeekToDate, change, workload, backlog, openFlags, topTechnicians, topServices } = stats;

  const headline =
    change.jobsCompleted === null
      ? `${thisWeek.jobsCompleted} jobs completed so far this week, earning ${myr(thisWeek.revenue)}.`
      : `${thisWeek.jobsCompleted} jobs completed this week (${change.jobsCompleted >= 0 ? "+" : ""}${change.jobsCompleted}% vs last week), ${myr(thisWeek.revenue)} billed.`;

  const highlights: InsightBriefing["highlights"] = [
    {
      title: "Throughput",
      detail: `${thisWeek.jobsCompleted} jobs completed vs ${lastWeekToDate.jobsCompleted} at the same point last week; ${changePhrase(change.jobsCompleted, "completion volume")}.`,
      tone: change.jobsCompleted === null ? "neutral" : change.jobsCompleted >= 0 ? "positive" : "warning",
    },
    {
      title: "Revenue",
      detail: `${myr(thisWeek.revenue)} billed vs ${myr(lastWeekToDate.revenue)}; ${changePhrase(change.revenue, "revenue")}.`,
      tone: change.revenue === null ? "neutral" : change.revenue >= 0 ? "positive" : "warning",
    },
  ];
  if (topTechnicians[0] && topTechnicians[0].jobs > 0) {
    const t = topTechnicians[0];
    highlights.push({
      title: "Top performer",
      detail: `${t.name} (${t.branch}) leads with ${t.jobs} jobs and ${myr(t.revenue)} billed${t.rating ? `, rated ${t.rating.toFixed(1)}/5` : ""}.`,
      tone: "positive",
    });
  }
  if (topServices[0] && topServices[0].jobs > 0) {
    highlights.push({
      title: "Service mix",
      detail: `${topServices[0].name} is the most requested service this week with ${topServices[0].jobs} jobs.`,
      tone: "neutral",
    });
  }
  if (openFlags.total > 0 || backlog.awaitingReview > 0) {
    highlights.push({
      title: "Needs attention",
      detail: `${openFlags.total} open supervisor flags (${openFlags.high} high) and ${backlog.awaitingReview} jobs awaiting review.`,
      tone: openFlags.high > 0 ? "warning" : "neutral",
    });
  }

  const overloaded = workload.overloaded.map((o) => ({
    technician: o.name,
    jobs: o.jobs,
    z_score: o.zScore,
    note: `${o.jobs} jobs this week, ${o.zScore.toFixed(1)}σ above the team average of ${workload.teamMean.toFixed(1)}${o.openJobs ? `, with ${o.openJobs} still open` : ""}.`,
  }));

  const recommendations: string[] = [];
  if (overloaded.length) {
    recommendations.push(
      `Rebalance new assignments away from ${overloaded.map((o) => o.technician).join(", ")}${workload.idle.length ? ` towards ${workload.idle.slice(0, 2).map((i) => i.name).join(" and ")}` : ""}.`,
    );
  }
  if (openFlags.high > 0) recommendations.push(`Clear the ${openFlags.high} high-severity supervisor flags before approving related jobs.`);
  if (backlog.awaitingReview > 0) recommendations.push(`Review the ${backlog.awaitingReview} completed jobs waiting in the review queue.`);
  if (backlog.new > 0) recommendations.push(`Assign the ${backlog.new} new orders still waiting for a technician.`);
  if (!recommendations.length) recommendations.push("Operations are on track — keep monitoring workload balance and review turnaround.");

  return { headline, highlights: highlights.slice(0, 5), overloaded, recommendations: recommendations.slice(0, 4) };
}

/**
 * Governance: the model may phrase things, but overloaded technicians and their
 * figures must come from the computed workload statistics.
 */
export function reconcileBriefing(briefing: InsightBriefing, stats: InsightStats): InsightBriefing {
  const byName = new Map(stats.workload.overloaded.map((o) => [o.name.toLowerCase(), o]));
  const seen = new Set<string>();
  const overloaded: InsightBriefing["overloaded"] = [];
  for (const o of briefing.overloaded) {
    const truth = byName.get(o.technician.trim().toLowerCase());
    if (!truth || seen.has(truth.name)) continue;
    seen.add(truth.name);
    overloaded.push({ technician: truth.name, jobs: truth.jobs, z_score: truth.zScore, note: o.note.trim().slice(0, 300) });
  }
  for (const truth of stats.workload.overloaded) {
    if (seen.has(truth.name)) continue;
    overloaded.push({
      technician: truth.name,
      jobs: truth.jobs,
      z_score: truth.zScore,
      note: `${truth.jobs} jobs this week, ${truth.zScore.toFixed(1)}σ above the team average.`,
    });
  }
  return {
    headline: briefing.headline.trim().slice(0, 240),
    highlights: briefing.highlights.slice(0, 5).map((h) => ({ ...h, title: h.title.slice(0, 80), detail: h.detail.slice(0, 400) })),
    overloaded,
    recommendations: briefing.recommendations.slice(0, 4).map((r) => r.slice(0, 300)),
  };
}
