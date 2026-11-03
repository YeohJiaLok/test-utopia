/**
 * Client-safe view types for the AI layer (no server imports). Module-facing
 * contracts live in `contracts.ts`; these are internal to the AI UI and routes.
 */
import type { ExtractedOrderFields } from "@/lib/ai/contracts";

export type CopilotRecord = { orderNo: string; orderId: string; label: string };

export type InsightTone = "positive" | "neutral" | "warning";

export interface InsightBriefing {
  headline: string;
  highlights: { title: string; detail: string; tone: InsightTone }[];
  overloaded: { technician: string; jobs: number; z_score: number; note: string }[];
  recommendations: string[];
}

export interface PeriodTotals {
  jobsCreated: number;
  jobsCompleted: number;
  revenue: number;
  reschedules: number;
}

/** The deterministic numbers the briefing is grounded in. */
export interface InsightStats {
  periodStart: string;
  periodEnd: string;
  /** Days of the current week elapsed, including today (1 = Monday) */
  daysElapsed: number;
  thisWeek: PeriodTotals;
  lastWeek: PeriodTotals;
  /** Last week over the same number of days, for a like-for-like comparison */
  lastWeekToDate: PeriodTotals;
  /** Percentage change, this week-to-date vs last week-to-date (null when the base is zero) */
  change: { jobsCompleted: number | null; revenue: number | null; reschedules: number | null };
  topTechnicians: { name: string; branch: string; jobs: number; revenue: number; rating: number | null }[];
  workload: {
    teamMean: number;
    teamStdDev: number;
    overloaded: { name: string; branch: string; jobs: number; openJobs: number; zScore: number }[];
    idle: { name: string; branch: string; openJobs: number }[];
  };
  topServices: { name: string; jobs: number; revenue: number }[];
  branches: { name: string; jobs: number; revenue: number; openJobs: number }[];
  backlog: { new: number; assigned: number; inProgress: number; awaitingReview: number };
  openFlags: { total: number; high: number; medium: number; low: number };
}

export interface InsightPayload {
  briefing: InsightBriefing;
  stats: InsightStats;
  generatedAt: string;
  source: "ai" | "fallback";
  model: string | null;
  cached: boolean;
  /** Why the deterministic fallback was used, if it was */
  notice?: string;
}

export type ExtractApiResponse =
  | { ok: true; fields: ExtractedOrderFields; runId: string | null }
  | { ok: false; error: string };
