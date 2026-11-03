import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ORDER_SELECT, normalizeOrder } from "@/lib/data/orders";
import { getRange, type RangeKey } from "@/lib/time";
import type {
  AiFlag,
  FlagSeverity,
  OrderWithRelations,
  TechnicianKpi,
  WorkloadStat,
} from "@/lib/types";

// ---------------------------------------------------------------- ranges ----

export const DASHBOARD_RANGES = ["this_week", "last_week", "this_month", "last_30_days", "last_8_weeks"] as const;
export type DashboardRangeKey = (typeof DASHBOARD_RANGES)[number];

export function isDashboardRange(value: unknown): value is DashboardRangeKey {
  return typeof value === "string" && (DASHBOARD_RANGES as readonly string[]).includes(value);
}

const PREVIOUS_LABEL: Record<DashboardRangeKey, string> = {
  this_week: "last week",
  last_week: "the week before",
  this_month: "last month",
  last_30_days: "the prior 30 days",
  last_8_weeks: "the prior 8 weeks",
};

export interface ComparedRange {
  key: DashboardRangeKey;
  label: string;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  /** e.g. "vs last week to date" */
  compareLabel: string;
  days: number;
}

/**
 * The current range plus the previous equivalent period. For periods still in progress
 * (this week / this month) the comparison is like-for-like: the same elapsed time.
 */
export function compareRange(key: DashboardRangeKey, now: Date = new Date()): ComparedRange {
  const cur = getRange(key as RangeKey, now);
  const from = new Date(cur.from).getTime();
  const to = new Date(cur.to).getTime();
  const elapsedEnd = Math.min(now.getTime(), to);
  const partial = elapsedEnd < to;

  const prevFrom = key === "this_month" ? new Date(getRange("last_month", now).from).getTime() : from - (to - from);
  const prevTo = Math.min(prevFrom + (elapsedEnd - from), from);

  return {
    key,
    label: cur.label,
    from: cur.from,
    to: cur.to,
    prevFrom: new Date(prevFrom).toISOString(),
    prevTo: new Date(prevTo).toISOString(),
    compareLabel: `vs ${PREVIOUS_LABEL[key]}${partial ? " to date" : ""}`,
    days: Math.round((to - from) / 86_400_000),
  };
}

/** Percentage change; null when there is no baseline to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

// -------------------------------------------------------------- mappers -----

const num = (v: unknown) => Number(v ?? 0);
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

type Row = Record<string, unknown>;

function mapTechnician(r: Row): TechnicianKpi {
  return {
    technician_id: String(r.technician_id),
    technician_name: String(r.technician_name),
    branch_name: String(r.branch_name),
    team_code: String(r.team_code),
    jobs_completed: num(r.jobs_completed),
    total_amount: num(r.total_amount),
    extra_charges: num(r.extra_charges),
    avg_ticket: num(r.avg_ticket),
    reschedules: num(r.reschedules),
    open_jobs: num(r.open_jobs),
    avg_hours_to_complete: numOrNull(r.avg_hours_to_complete),
    avg_rating: numOrNull(r.avg_rating),
  };
}

function mapWorkload(r: Row): WorkloadStat {
  return {
    technician_id: String(r.technician_id),
    technician_name: String(r.technician_name),
    branch_name: String(r.branch_name),
    jobs_completed: num(r.jobs_completed),
    open_jobs: num(r.open_jobs),
    reschedules: num(r.reschedules),
    team_mean: num(r.team_mean),
    team_stddev: num(r.team_stddev),
    z_score: num(r.z_score),
  };
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}: ${error?.message ?? "unknown error"}`);
}

// ------------------------------------------------------------- dashboard ----

export interface DailyPoint {
  /** Axis label, e.g. "Mon 3" or "3 Nov" */
  label: string;
  /** Tooltip title, e.g. "Monday, 3 Nov 2026" or "Week of 3 Nov" */
  title: string;
  jobs: number;
  revenue: number;
  created: number;
}

export interface ServiceMixRow {
  code: string;
  name: string;
  jobs: number;
  revenue: number;
}

export interface BranchRow {
  code: string;
  name: string;
  jobs: number;
  revenue: number;
  openJobs: number;
  technicians: number;
}

export interface DashboardData {
  range: ComparedRange;
  stats: {
    jobs: { value: number; delta: number | null; previous: number };
    revenue: { value: number; delta: number | null; previous: number };
    avgTicket: { value: number; delta: number | null; previous: number };
    reschedules: { value: number; previous: number };
    pendingReviews: { value: number; oldestCompletedAt: string | null };
    openFlags: { value: number; high: number };
  };
  technicians: TechnicianKpi[];
  daily: DailyPoint[];
  granularity: "day" | "week";
  serviceMix: ServiceMixRow[];
  branches: BranchRow[];
  workload: WorkloadStat[];
}

const utcDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
};
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-MY", { timeZone: "UTC", ...opts });
const fmtWeekdayDay = fmt({ weekday: "short", day: "numeric" });
const fmtDayMonth = fmt({ day: "numeric", month: "short" });
const fmtFull = fmt({ weekday: "long", day: "numeric", month: "short", year: "numeric" });

function buildDaily(rows: Row[]): { points: DailyPoint[]; granularity: "day" | "week" } {
  const days = rows.map((r) => ({
    date: utcDay(String(r.day)),
    jobs: num(r.jobs_completed),
    revenue: num(r.revenue),
    created: num(r.jobs_created),
  }));

  if (days.length <= 35) {
    const short = days.length <= 7;
    return {
      granularity: "day",
      points: days.map((d) => ({
        label: short ? fmtWeekdayDay.format(d.date) : fmtDayMonth.format(d.date),
        title: fmtFull.format(d.date),
        jobs: d.jobs,
        revenue: d.revenue,
        created: d.created,
      })),
    };
  }

  const weeks: DailyPoint[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    const start = chunk[0]!.date;
    weeks.push({
      label: fmtDayMonth.format(start),
      title: `Week of ${fmtDayMonth.format(start)}`,
      jobs: chunk.reduce((s, d) => s + d.jobs, 0),
      revenue: chunk.reduce((s, d) => s + d.revenue, 0),
      created: chunk.reduce((s, d) => s + d.created, 0),
    });
  }
  return { granularity: "week", points: weeks };
}

export async function getDashboardData(key: DashboardRangeKey): Promise<DashboardData> {
  const supabase = await createClient();
  const range = compareRange(key);
  const cur = { p_from: range.from, p_to: range.to };
  const prev = { p_from: range.prevFrom, p_to: range.prevTo };

  const [techs, daily, prevDaily, mix, branches, workload, resched, prevResched, pending, flags] = await Promise.all([
    supabase.rpc("kpi_technician_summary", cur),
    supabase.rpc("kpi_daily", cur),
    supabase.rpc("kpi_daily", prev),
    supabase.rpc("kpi_service_mix", cur),
    supabase.rpc("kpi_branch_summary", cur),
    supabase.rpc("workload_stats", cur),
    supabase.from("reschedules").select("id", { count: "exact", head: true }).gte("created_at", range.from).lt("created_at", range.to),
    supabase
      .from("reschedules")
      .select("id", { count: "exact", head: true })
      .gte("created_at", range.prevFrom)
      .lt("created_at", range.prevTo),
    supabase
      .from("orders")
      .select("completed_at", { count: "exact" })
      .eq("status", "job_done")
      .order("completed_at", { ascending: true, nullsFirst: false })
      .limit(1),
    supabase.from("ai_flags").select("severity").eq("resolved", false).limit(5000),
  ]);

  if (techs.error) fail("technician KPIs", techs.error);
  if (daily.error) fail("daily KPIs", daily.error);
  if (prevDaily.error) fail("comparison KPIs", prevDaily.error);
  if (mix.error) fail("service mix", mix.error);
  if (branches.error) fail("branch summary", branches.error);
  if (workload.error) fail("workload stats", workload.error);

  const dailyRows = (daily.data ?? []) as Row[];
  const prevRows = (prevDaily.data ?? []) as Row[];
  const sum = (rows: Row[], k: string) => rows.reduce((s, r) => s + num(r[k]), 0);

  const jobs = sum(dailyRows, "jobs_completed");
  const revenue = sum(dailyRows, "revenue");
  const prevJobs = sum(prevRows, "jobs_completed");
  const prevRevenue = sum(prevRows, "revenue");
  const avgTicket = jobs ? revenue / jobs : 0;
  const prevAvgTicket = prevJobs ? prevRevenue / prevJobs : 0;

  const flagRows = (flags.data ?? []) as { severity: FlagSeverity }[];
  const { points, granularity } = buildDaily(dailyRows);

  return {
    range,
    stats: {
      jobs: { value: jobs, previous: prevJobs, delta: pctChange(jobs, prevJobs) },
      revenue: { value: revenue, previous: prevRevenue, delta: pctChange(revenue, prevRevenue) },
      avgTicket: { value: avgTicket, previous: prevAvgTicket, delta: prevJobs && jobs ? pctChange(avgTicket, prevAvgTicket) : null },
      reschedules: { value: resched.count ?? 0, previous: prevResched.count ?? 0 },
      pendingReviews: {
        value: pending.count ?? 0,
        oldestCompletedAt: ((pending.data ?? [])[0] as { completed_at: string | null } | undefined)?.completed_at ?? null,
      },
      openFlags: { value: flagRows.length, high: flagRows.filter((f) => f.severity === "high").length },
    },
    technicians: ((techs.data ?? []) as Row[]).map(mapTechnician),
    daily: points,
    granularity,
    serviceMix: ((mix.data ?? []) as Row[]).map((r) => ({
      code: String(r.service_code),
      name: String(r.service_name),
      jobs: num(r.jobs),
      revenue: num(r.revenue),
    })),
    branches: ((branches.data ?? []) as Row[]).map((r) => ({
      code: String(r.branch_code),
      name: String(r.branch_name),
      jobs: num(r.jobs_completed),
      revenue: num(r.revenue),
      openJobs: num(r.open_jobs),
      technicians: num(r.technicians),
    })),
    workload: ((workload.data ?? []) as Row[]).map(mapWorkload),
  };
}

// --------------------------------------------------------- review queue -----

export interface QueueItem {
  id: string;
  orderNo: string;
  customerName: string;
  serviceName: string;
  technicianId: string | null;
  technicianName: string;
  branchName: string | null;
  quoted: number;
  extra: number;
  final: number;
  completedAt: string | null;
  photoCount: number;
  fileCount: number;
  openFlags: number;
  topSeverity: FlagSeverity | null;
  reworked: boolean;
}

const SEVERITY_RANK: Record<FlagSeverity, number> = { high: 3, medium: 2, low: 1 };

export function highestSeverity(list: FlagSeverity[]): FlagSeverity | null {
  return list.reduce<FlagSeverity | null>((top, s) => (!top || SEVERITY_RANK[s] > SEVERITY_RANK[top] ? s : top), null);
}

export async function getReviewQueue(): Promise<{ items: QueueItem[]; asOf: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `${ORDER_SELECT}, completion:job_completions(quoted_price, extra_charges, final_amount, completed_at), files:order_attachments(kind), flags:ai_flags(severity, resolved), review:reviews(decision)`,
    )
    .eq("status", "job_done")
    .order("completed_at", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) fail("the review queue", error);

  const items = ((data ?? []) as Row[]).map((raw): QueueItem => {
    const o = normalizeOrder(raw as unknown as OrderWithRelations);
    const c = one(raw.completion as Row | Row[] | null);
    const files = (raw.files ?? []) as { kind: string }[];
    const open = ((raw.flags ?? []) as { severity: FlagSeverity; resolved: boolean }[]).filter((f) => !f.resolved);
    const review = one(raw.review as { decision: string } | { decision: string }[] | null);
    const quoted = c ? num(c.quoted_price) : o.quoted_price;
    const extra = c ? num(c.extra_charges) : 0;
    return {
      id: o.id,
      orderNo: o.order_no,
      customerName: o.customer_name,
      serviceName: o.service_type?.name ?? "Service",
      technicianId: o.technician?.id ?? null,
      technicianName: o.technician?.name ?? "Unassigned",
      branchName: o.branch?.name ?? null,
      quoted,
      extra,
      final: c ? num(c.final_amount) : quoted + extra,
      completedAt: (c?.completed_at as string | undefined) ?? o.completed_at,
      photoCount: files.filter((f) => f.kind === "photo").length,
      fileCount: files.filter((f) => f.kind !== "receipt").length,
      openFlags: open.length,
      topSeverity: highestSeverity(open.map((f) => f.severity)),
      reworked: review?.decision === "rework",
    };
  });
  return { items, asOf: Date.now() };
}

/** Ids of orders awaiting review, oldest completion first. */
export async function getQueueIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "job_done")
    .order("completed_at", { ascending: true, nullsFirst: false })
    .limit(500);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

// ---------------------------------------------------------------- flags -----

export interface FlagWithOrder extends AiFlag {
  order: {
    id: string;
    order_no: string;
    status: OrderWithRelations["status"];
    customer_name: string;
    technician: { id: string; name: string } | null;
  } | null;
  resolver: { full_name: string } | null;
}

export async function getFlags(resolved: boolean): Promise<FlagWithOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_flags")
    .select(
      "*, order:orders(id, order_no, status, customer_name, technician:technicians(id, name)), resolver:profiles(full_name)",
    )
    .eq("resolved", resolved)
    .order(resolved ? "resolved_at" : "created_at", { ascending: false })
    .limit(300);
  if (error) fail("AI flags", error);

  return ((data ?? []) as Row[]).map((r) => {
    const order = one(r.order as Row | Row[] | null);
    return {
      ...(r as unknown as AiFlag),
      evidence: (r.evidence ?? {}) as Record<string, unknown>,
      order: order
        ? {
            id: String(order.id),
            order_no: String(order.order_no),
            status: order.status as OrderWithRelations["status"],
            customer_name: String(order.customer_name),
            technician: one(order.technician as { id: string; name: string } | null),
          }
        : null,
      resolver: one(r.resolver as { full_name: string } | null),
    };
  });
}
