import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiModel, describeAiError, errorDetail, getAnthropic } from "@/lib/ai/client";
import { buildFallbackBriefing, OVERLOAD_Z, pctChange, reconcileBriefing } from "@/lib/ai/briefing";
import { logAiRun } from "@/lib/ai/log";
import { INSIGHT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { InsightBriefing, InsightPayload, InsightStats, PeriodTotals } from "@/lib/ai/types";
import { TIMEZONE } from "@/lib/format";
import { getRange } from "@/lib/time";
import type { AiToolCall, FlagSeverity, SessionUser } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const SCOPE = "company";
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

const BriefingSchema = z.object({
  headline: z.string(),
  highlights: z.array(z.object({ title: z.string(), detail: z.string(), tone: z.enum(["positive", "neutral", "warning"]) })),
  overloaded: z.array(z.object({ technician: z.string(), jobs: z.number(), z_score: z.number(), note: z.string() })),
  recommendations: z.array(z.string()),
});

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

function mytDate(iso: string | Date) {
  return format(new TZDate(new Date(iso), TIMEZONE), "yyyy-MM-dd");
}

interface DailyRow {
  day: string;
  jobs_created: number | string;
  jobs_completed: number | string;
  revenue: number | string;
}

function sumDays(rows: DailyRow[], days?: number): Omit<PeriodTotals, "reschedules"> {
  const slice = days === undefined ? rows : rows.slice(0, days);
  return {
    jobsCreated: slice.reduce((s, r) => s + n(r.jobs_created), 0),
    jobsCompleted: slice.reduce((s, r) => s + n(r.jobs_completed), 0),
    revenue: Math.round(slice.reduce((s, r) => s + n(r.revenue), 0) * 100) / 100,
  };
}

/** Deterministic weekly statistics (user-scoped client, so RLS applies). */
export async function computeInsightStats(supabase: Supabase, now = new Date()): Promise<{ stats: InsightStats; trace: AiToolCall[] }> {
  const thisWeek = getRange("this_week", now);
  const lastWeek = getRange("last_week", now);
  const elapsedMs = Math.max(0, now.getTime() - Date.parse(thisWeek.from));
  const daysElapsed = Math.min(7, Math.floor(elapsedMs / DAY_MS) + 1);
  const lastToDateEnd = new Date(Date.parse(lastWeek.from) + elapsedMs).toISOString();
  const trace: AiToolCall[] = [];

  async function timed<T>(name: string, input: unknown, run: () => PromiseLike<{ data: T | null; error: { message: string } | null; count?: number | null }>) {
    const started = performance.now();
    const res = await run();
    const ms = Math.round(performance.now() - started);
    if (res.error) {
      trace.push({ name, input, ok: false, ms, error: res.error.message });
      throw new Error(`${name} failed: ${res.error.message}`);
    }
    trace.push({ name, input, ok: true, ms, rows: Array.isArray(res.data) ? res.data.length : (res.count ?? 1) });
    return res;
  }

  const thisArgs = { p_from: thisWeek.from, p_to: thisWeek.to };
  const lastArgs = { p_from: lastWeek.from, p_to: lastWeek.to };
  const countReschedules = (from: string, to: string) =>
    timed("reschedules", { from, to }, () =>
      supabase.from("reschedules").select("id", { count: "exact", head: true }).gte("created_at", from).lt("created_at", to),
    );

  const [dailyThis, dailyLast, techs, workload, services, branches, statuses, flags, rsThis, rsLast, rsLastToDate] = await Promise.all([
    timed<DailyRow[]>("kpi_daily", thisArgs, () => supabase.rpc("kpi_daily", thisArgs)),
    timed<DailyRow[]>("kpi_daily", lastArgs, () => supabase.rpc("kpi_daily", lastArgs)),
    timed<Record<string, unknown>[]>("kpi_technician_summary", thisArgs, () => supabase.rpc("kpi_technician_summary", thisArgs)),
    timed<Record<string, unknown>[]>("workload_stats", thisArgs, () => supabase.rpc("workload_stats", thisArgs)),
    timed<Record<string, unknown>[]>("kpi_service_mix", thisArgs, () => supabase.rpc("kpi_service_mix", thisArgs)),
    timed<Record<string, unknown>[]>("kpi_branch_summary", thisArgs, () => supabase.rpc("kpi_branch_summary", thisArgs)),
    timed<{ status: string; total: number | string }[]>("kpi_status_counts", {}, () => supabase.rpc("kpi_status_counts")),
    timed<{ severity: FlagSeverity }[]>("ai_flags", { resolved: false }, () => supabase.from("ai_flags").select("severity").eq("resolved", false).limit(5000)),
    countReschedules(thisWeek.from, thisWeek.to),
    countReschedules(lastWeek.from, lastWeek.to),
    countReschedules(lastWeek.from, lastToDateEnd),
  ]);

  const dThis = (dailyThis.data ?? []) as DailyRow[];
  const dLast = (dailyLast.data ?? []) as DailyRow[];
  const totalsThis: PeriodTotals = { ...sumDays(dThis), reschedules: rsThis.count ?? 0 };
  const totalsLast: PeriodTotals = { ...sumDays(dLast), reschedules: rsLast.count ?? 0 };
  const totalsLastToDate: PeriodTotals = { ...sumDays(dLast, daysElapsed), reschedules: rsLastToDate.count ?? 0 };

  const wl = (workload.data ?? []) as Record<string, unknown>[];
  const statusMap = new Map(((statuses.data ?? []) as { status: string; total: number | string }[]).map((s) => [s.status, n(s.total)]));
  const flagRows = (flags.data ?? []) as { severity: FlagSeverity }[];

  const stats: InsightStats = {
    periodStart: mytDate(thisWeek.from),
    periodEnd: mytDate(addDays(new Date(thisWeek.to), -1)),
    daysElapsed,
    thisWeek: totalsThis,
    lastWeek: totalsLast,
    lastWeekToDate: totalsLastToDate,
    change: {
      jobsCompleted: pctChange(totalsThis.jobsCompleted, totalsLastToDate.jobsCompleted),
      revenue: pctChange(totalsThis.revenue, totalsLastToDate.revenue),
      reschedules: pctChange(totalsThis.reschedules, totalsLastToDate.reschedules),
    },
    topTechnicians: ((techs.data ?? []) as Record<string, unknown>[]).slice(0, 5).map((t) => ({
      name: String(t.technician_name),
      branch: String(t.branch_name),
      jobs: n(t.jobs_completed),
      revenue: n(t.total_amount),
      rating: t.avg_rating === null || t.avg_rating === undefined ? null : n(t.avg_rating),
    })),
    workload: {
      teamMean: n(wl[0]?.team_mean),
      teamStdDev: n(wl[0]?.team_stddev),
      overloaded: wl
        .filter((w) => n(w.z_score) >= OVERLOAD_Z && n(w.jobs_completed) > 0)
        .map((w) => ({ name: String(w.technician_name), branch: String(w.branch_name), jobs: n(w.jobs_completed), openJobs: n(w.open_jobs), zScore: n(w.z_score) })),
      idle: wl
        .filter((w) => n(w.jobs_completed) === 0 && n(w.open_jobs) === 0)
        .slice(0, 5)
        .map((w) => ({ name: String(w.technician_name), branch: String(w.branch_name), openJobs: n(w.open_jobs) })),
    },
    topServices: ((services.data ?? []) as Record<string, unknown>[])
      .filter((s) => n(s.jobs) > 0)
      .slice(0, 5)
      .map((s) => ({ name: String(s.service_name), jobs: n(s.jobs), revenue: n(s.revenue) })),
    branches: ((branches.data ?? []) as Record<string, unknown>[]).map((b) => ({
      name: String(b.branch_name),
      jobs: n(b.jobs_completed),
      revenue: n(b.revenue),
      openJobs: n(b.open_jobs),
    })),
    backlog: {
      new: statusMap.get("new") ?? 0,
      assigned: statusMap.get("assigned") ?? 0,
      inProgress: statusMap.get("in_progress") ?? 0,
      awaitingReview: statusMap.get("job_done") ?? 0,
    },
    openFlags: {
      total: flagRows.length,
      high: flagRows.filter((f) => f.severity === "high").length,
      medium: flagRows.filter((f) => f.severity === "medium").length,
      low: flagRows.filter((f) => f.severity === "low").length,
    },
  };
  return { stats, trace };
}

async function generateBriefing(stats: InsightStats, user: SessionUser, trace: AiToolCall[]): Promise<Pick<InsightPayload, "briefing" | "source" | "model" | "notice">> {
  const client = getAnthropic();
  const model = aiModel();
  const started = performance.now();
  if (!client) {
    return { briefing: buildFallbackBriefing(stats), source: "fallback", model: null, notice: "AI is not configured — showing a rule-based summary." };
  }
  try {
    const response = await client.messages.parse(
      {
        model,
        max_tokens: 6000,
        system: INSIGHT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Write this week's operational briefing. Comparisons are week-to-date: this week (${stats.daysElapsed} day(s) so far) vs the same days last week.\n\nStatistics (JSON):\n${JSON.stringify(stats, null, 2)}`,
          },
        ],
        output_config: { effort: "medium", format: zodOutputFormat(BriefingSchema) },
      },
      { timeout: 90_000 },
    );
    const latencyMs = performance.now() - started;
    const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens" || !response.parsed_output) {
      await logAiRun({ kind: "insight", userId: user.id, input: `week ${stats.periodStart}`, toolCalls: trace, model, ...usage, latencyMs, status: response.stop_reason === "refusal" ? "refused" : "error", error: `stop_reason: ${response.stop_reason}` });
      return { briefing: buildFallbackBriefing(stats), source: "fallback", model: null, notice: "The AI briefing was unavailable — showing a rule-based summary." };
    }
    const briefing: InsightBriefing = reconcileBriefing(response.parsed_output, stats);
    await logAiRun({ kind: "insight", userId: user.id, input: `week ${stats.periodStart}`, toolCalls: trace, output: JSON.stringify(briefing), model, ...usage, latencyMs, status: "ok" });
    return { briefing, source: "ai", model };
  } catch (err) {
    console.error("[ai] insight generation failed:", describeAiError(err));
    await logAiRun({ kind: "insight", userId: user.id, input: `week ${stats.periodStart}`, toolCalls: trace, model, latencyMs: performance.now() - started, status: "error", error: errorDetail(err) });
    return { briefing: buildFallbackBriefing(stats), source: "fallback", model: null, notice: `${describeAiError(err)} Showing a rule-based summary.` };
  }
}

/**
 * Weekly AI operational briefing. Served from the ai_insights cache when fresh
 * (unless `force`), otherwise recomputed and cached with the service-role client.
 */
export async function getInsights(user: SessionUser, { force = false }: { force?: boolean } = {}): Promise<InsightPayload> {
  const supabase = await createClient();
  const periodStart = mytDate(getRange("this_week").from);

  if (!force) {
    const { data } = await supabase
      .from("ai_insights")
      .select("content, created_at")
      .eq("period_start", periodStart)
      .eq("scope", SCOPE)
      .maybeSingle();
    const cached = data as { content: InsightPayload; created_at: string } | null;
    if (cached?.content?.briefing && Date.now() - Date.parse(cached.content.generatedAt ?? cached.created_at) < CACHE_TTL_MS) {
      return { ...cached.content, cached: true };
    }
  }

  const { stats, trace } = await computeInsightStats(supabase);
  const generated = await generateBriefing(stats, user, trace);
  const payload: InsightPayload = { ...generated, stats, generatedAt: new Date().toISOString(), cached: false };

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("ai_insights").upsert(
      {
        period_start: stats.periodStart,
        period_end: stats.periodEnd,
        scope: SCOPE,
        content: payload,
        generated_by: user.id,
        created_at: payload.generatedAt,
      },
      { onConflict: "period_start,scope" },
    );
    if (error) console.error("[ai] failed to cache insight", error.message);
  } catch (err) {
    console.error("[ai] failed to cache insight", err);
  }
  return payload;
}
