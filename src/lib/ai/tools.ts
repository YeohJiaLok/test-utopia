import "server-only";
import type { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaRunnableTool } from "@anthropic-ai/sdk/lib/tools/BetaRunnableTool";
import type { createClient } from "@/lib/supabase/server";
import { TOOL_CATALOGUE, MAX_TOOL_ROWS, type CopilotToolName } from "@/lib/ai/catalogue";
import {
  COMPLETED_STATUSES,
  countJobsSchema,
  emptySchema,
  listFlagsSchema,
  listTechniciansSchema,
  normalizeInstant,
  orderDetailsSchema,
  resolveLimit,
  searchJobsSchema,
  technicianPerformanceSchema,
  textMatches,
  workloadSchema,
  type CountJobsInput,
  type SearchJobsInput,
} from "@/lib/ai/tool-schemas";
import type { CopilotRecord } from "@/lib/ai/types";
import { formatDateTime, maskPhone, TIMEZONE } from "@/lib/format";
import { timeContext } from "@/lib/time";
import type { AiToolCall, FlagSeverity, OrderStatus } from "@/lib/types";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const QUERY_TIMEOUT_MS = 10_000;
/** Upper bound of rows scanned for in-memory aggregation in count_jobs. */
const AGGREGATE_SCAN_LIMIT = 1000;

export interface ToolHooks {
  onCall(event: { id: string; name: string; input: unknown }): void;
  onResult(event: { id: string; name: string; ok: boolean; rows: number; ms: number; summary: string }): void;
}

export interface ToolContext {
  supabase: Supabase;
  signal: AbortSignal;
  hooks: ToolHooks;
  /** Governance trace, persisted to ai_runs.tool_calls */
  trace: AiToolCall[];
  /** Order records surfaced by tool results (for UI record chips) */
  records: Map<string, CopilotRecord>;
}

interface ToolOutput {
  data: unknown;
  rows: number;
  summary: string;
  records?: CopilotRecord[];
}

/** A tool-safe error: its message is returned to the model and shown in the trace. */
class ToolQueryError extends Error {}

// ------------------------------------------------------------------ helpers --

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function n(value: unknown): number {
  const v = Number(value ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function nOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const v = Number(value);
  return Number.isFinite(v) ? v : null;
}

function mytDay(iso: string) {
  return format(new TZDate(new Date(iso), TIMEZONE), "yyyy-MM-dd (EEE)");
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function querySignal(ctx: ToolContext) {
  return AbortSignal.any([ctx.signal, AbortSignal.timeout(QUERY_TIMEOUT_MS)]);
}

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) {
    console.error(`[ai] ${what} query failed`, result.error.message);
    throw new ToolQueryError(`The ${what} query failed. Try a simpler question.`);
  }
  return result.data as T;
}

interface TechRef {
  id: string;
  name: string;
  team_code: string;
  skills: string[];
  branch_id: number;
  active: boolean;
}
interface ServiceRef {
  id: number;
  code: string;
  name: string;
}
interface BranchRef {
  id: number;
  code: string;
  name: string;
}
interface Reference {
  technicians: TechRef[];
  services: ServiceRef[];
  branches: BranchRef[];
}

/** Small reference tables, loaded once per agent run (RLS-scoped). */
function referenceLoader(ctx: ToolContext) {
  let pending: Promise<Reference> | null = null;
  return () => {
    pending ??= (async () => {
      const signal = querySignal(ctx);
      const [t, s, b] = await Promise.all([
        ctx.supabase.from("technicians").select("id, name, team_code, skills, branch_id, active").order("name").abortSignal(signal),
        ctx.supabase.from("service_types").select("id, code, name").order("id").abortSignal(signal),
        ctx.supabase.from("branches").select("id, code, name").order("id").abortSignal(signal),
      ]);
      return {
        technicians: check(t, "technician") ?? [],
        services: check(s, "service type") ?? [],
        branches: check(b, "branch") ?? [],
      } as Reference;
    })();
    pending.catch(() => {
      pending = null;
    });
    return pending;
  };
}

interface ResolvedFilters {
  techIds?: string[];
  serviceIds?: number[];
  branchIds?: number[];
  /** Set when a name filter matched nothing — the tool answers without querying orders */
  miss?: { data: unknown; summary: string };
}

async function resolveFilters(input: SearchJobsInput | CountJobsInput, ref: Reference): Promise<ResolvedFilters> {
  const out: ResolvedFilters = {};
  if (input.technician) {
    const matches = ref.technicians.filter((t) => textMatches(t.name, input.technician!));
    if (!matches.length) {
      return {
        miss: {
          data: {
            matches: 0,
            note: `No technician matches "${input.technician}".`,
            known_technicians: ref.technicians.filter((t) => t.active).map((t) => t.name),
          },
          summary: `No technician matches "${input.technician}"`,
        },
      };
    }
    out.techIds = matches.map((t) => t.id);
  }
  if (input.service) {
    const s = input.service;
    const matches = ref.services.filter((x) => x.code.toLowerCase() === s.toLowerCase() || textMatches(x.name, s) || textMatches(x.code, s));
    if (!matches.length) {
      return {
        miss: {
          data: { matches: 0, note: `No service type matches "${s}".`, service_types: ref.services.map((x) => `${x.code} – ${x.name}`) },
          summary: `No service matches "${s}"`,
        },
      };
    }
    out.serviceIds = matches.map((x) => x.id);
  }
  if (input.branch) {
    const b = input.branch;
    const matches = ref.branches.filter((x) => x.code.toLowerCase() === b.toLowerCase() || textMatches(x.name, b));
    if (!matches.length) {
      return {
        miss: {
          data: { matches: 0, note: `No branch matches "${b}".`, branches: ref.branches.map((x) => `${x.code} – ${x.name}`) },
          summary: `No branch matches "${b}"`,
        },
      };
    }
    out.branchIds = matches.map((x) => x.id);
  }
  return out;
}

/** Structural view of the PostgREST filter methods we use (keeps generics shallow). */
interface FilterChain {
  in(column: string, values: readonly unknown[]): this;
  not(column: string, operator: string, value: unknown): this;
  gte(column: string, value: unknown): this;
  lt(column: string, value: unknown): this;
}

/** Apply the shared, parameterised job filters to an orders query. */
function applyJobFilters<Q extends FilterChain>(query: Q, input: SearchJobsInput | CountJobsInput, f: ResolvedFilters): Q {
  let q = query;
  const field = input.date_field ?? "created_at";
  if (f.techIds) q = q.in("assigned_technician_id", f.techIds);
  if (f.serviceIds) q = q.in("service_type_id", f.serviceIds);
  if (f.branchIds) q = q.in("branch_id", f.branchIds);
  if (input.status?.length) q = q.in("status", input.status);
  else if (field === "completed_at") q = q.in("status", COMPLETED_STATUSES);
  if (input.date_field) q = q.not(field, "is", null);
  if (input.from) q = q.gte(field, normalizeInstant(input.from));
  if (input.to) q = q.lt(field, normalizeInstant(input.to));
  return q;
}

function describeFilters(input: SearchJobsInput | CountJobsInput) {
  const parts: string[] = [];
  if (input.technician) parts.push(input.technician);
  if (input.service) parts.push(input.service);
  if (input.branch) parts.push(input.branch);
  if (input.status?.length) parts.push(input.status.join("/"));
  return parts.length ? ` (${parts.join(", ")})` : "";
}

// ------------------------------------------------------------ definitions --

type Impl<I> = (input: I, ctx: ToolContext, ref: () => Promise<Reference>) => Promise<ToolOutput>;

interface ToolDef {
  name: CopilotToolName;
  schema: z.ZodType;
  impl: Impl<unknown>;
}

/** Typed at definition; erased for the registry (the runner validates input against `schema` before `impl` runs). */
function defineTool<S extends z.ZodType>(name: CopilotToolName, schema: S, impl: Impl<z.infer<S>>): ToolDef {
  return { name, schema, impl: impl as Impl<unknown> };
}

const TOOL_IMPLS: ToolDef[] = [
  defineTool("get_time_context", emptySchema, async () => {
    const ctx = timeContext();
    return { data: ctx, rows: 0, summary: `Today is ${ctx.today} (Malaysia time)` };
  }),

  defineTool("list_technicians", listTechniciansSchema, async (input, _ctx, ref) => {
    const { technicians, branches } = await ref();
    const branchName = new Map(branches.map((b) => [b.id, b]));
    const rows = technicians
      .filter((t) => t.active)
      .filter((t) => {
        if (!input.branch) return true;
        const b = branchName.get(t.branch_id);
        return !!b && (b.code.toLowerCase() === input.branch.toLowerCase() || textMatches(b.name, input.branch));
      })
      .slice(0, MAX_TOOL_ROWS)
      .map((t) => ({ name: t.name, branch: branchName.get(t.branch_id)?.name ?? null, team: t.team_code, skills: t.skills }));
    return { data: { technicians: rows }, rows: rows.length, summary: `${plural(rows.length, "technician")}${input.branch ? ` in ${input.branch}` : ""}` };
  }),

  defineTool("search_jobs", searchJobsSchema, async (input, ctx, ref) => {
    const filters = await resolveFilters(input, await ref());
    if (filters.miss) return { data: filters.miss.data, rows: 0, summary: filters.miss.summary };
    const limit = resolveLimit(input.limit);
    const field = input.date_field ?? "created_at";
    const base = ctx.supabase
      .from("orders")
      .select(
        "id, order_no, status, customer_name, quoted_price, created_at, scheduled_at, completed_at, reschedule_count, service_type:service_types(code, name), technician:technicians(name), branch:branches(name), completion:job_completions(final_amount, extra_charges, payment_method)",
        { count: "exact" },
      );
    const result = await applyJobFilters(base, input, filters)
      .order(field, { ascending: false, nullsFirst: false })
      .limit(limit)
      .abortSignal(querySignal(ctx));
    const data = check(result, "job search") as unknown as SearchRow[];
    const total = result.count ?? data.length;
    const records: CopilotRecord[] = [];
    const jobs = data.map((o) => {
      const service = one(o.service_type);
      const tech = one(o.technician);
      const completion = one(o.completion);
      records.push({ orderNo: o.order_no, orderId: o.id, label: [service?.name, tech?.name].filter(Boolean).join(" · ") || o.status });
      return {
        order_no: o.order_no,
        status: o.status,
        service: service?.name ?? null,
        technician: tech?.name ?? null,
        branch: one(o.branch)?.name ?? null,
        customer: o.customer_name,
        quoted_price_myr: n(o.quoted_price),
        final_amount_myr: completion ? n(completion.final_amount) : null,
        extra_charges_myr: completion ? n(completion.extra_charges) : null,
        payment_method: completion?.payment_method ?? null,
        reschedules: o.reschedule_count,
        created: formatDateTime(o.created_at),
        scheduled: o.scheduled_at ? formatDateTime(o.scheduled_at) : null,
        completed: o.completed_at ? formatDateTime(o.completed_at) : null,
      };
    });
    return {
      data: { total_matching: total, returned: jobs.length, truncated: total > jobs.length, jobs },
      rows: jobs.length,
      summary: `${plural(total, "job")} found${describeFilters(input)}${total > jobs.length ? `, showing ${jobs.length}` : ""}`,
      records,
    };
  }),

  defineTool("count_jobs", countJobsSchema, async (input, ctx, ref) => {
    const reference = await ref();
    const filters = await resolveFilters(input, reference);
    if (filters.miss) return { data: filters.miss.data, rows: 0, summary: filters.miss.summary };
    const base = ctx.supabase
      .from("orders")
      .select("id, status, created_at, scheduled_at, completed_at, assigned_technician_id, service_type_id, branch_id, completion:job_completions(final_amount)", {
        count: "exact",
      });
    const result = await applyJobFilters(base, input, filters).limit(AGGREGATE_SCAN_LIMIT).abortSignal(querySignal(ctx));
    const data = check(result, "job count") as unknown as CountRow[];
    const total = result.count ?? data.length;
    const amount = (r: CountRow) => n(one(r.completion)?.final_amount);
    const totalAmount = Math.round(data.reduce((s, r) => s + amount(r), 0) * 100) / 100;

    if (!input.group_by) {
      return {
        data: { total_jobs: total, total_final_amount_myr: totalAmount },
        rows: total,
        summary: `${plural(total, "job")}${describeFilters(input)}`,
      };
    }

    const techName = new Map(reference.technicians.map((t) => [t.id, t.name]));
    const serviceName = new Map(reference.services.map((s) => [s.id, s.name]));
    const branchName = new Map(reference.branches.map((b) => [b.id, b.name]));
    const field = input.date_field ?? "created_at";
    const keyOf = (r: CountRow): string => {
      switch (input.group_by) {
        case "technician":
          return r.assigned_technician_id ? (techName.get(r.assigned_technician_id) ?? "Unknown technician") : "Unassigned";
        case "status":
          return r.status;
        case "service":
          return serviceName.get(r.service_type_id) ?? "Unknown service";
        case "branch":
          return r.branch_id ? (branchName.get(r.branch_id) ?? "Unknown branch") : "No branch";
        case "day": {
          const v = r[field];
          return v ? mytDay(v) : "No date";
        }
        default:
          return "All";
      }
    };
    const groups = new Map<string, { jobs: number; amount: number }>();
    for (const r of data) {
      const k = keyOf(r);
      const g = groups.get(k) ?? { jobs: 0, amount: 0 };
      g.jobs += 1;
      g.amount += amount(r);
      groups.set(k, g);
    }
    const rows = Array.from(groups, ([key, g]) => ({ [input.group_by!]: key, jobs: g.jobs, final_amount_myr: Math.round(g.amount * 100) / 100 }));
    if (input.group_by === "day") rows.sort((a, b) => String(a.day).localeCompare(String(b.day)));
    else rows.sort((a, b) => b.jobs - a.jobs);
    const top = input.group_by !== "day" && rows[0] ? `; top: ${rows[0][input.group_by]} (${rows[0].jobs})` : "";
    return {
      data: {
        total_jobs: total,
        counted: data.length,
        truncated: total > data.length,
        group_by: input.group_by,
        groups: rows.slice(0, MAX_TOOL_ROWS),
      },
      rows: total,
      summary: `${plural(total, "job")} by ${input.group_by}${describeFilters(input)}${top}`,
    };
  }),

  defineTool("technician_performance", technicianPerformanceSchema, async (input, ctx) => {
    const result = await ctx.supabase
      .rpc("kpi_technician_summary", { p_from: normalizeInstant(input.from), p_to: normalizeInstant(input.to) })
      .abortSignal(querySignal(ctx));
    const data = (check(result, "performance") ?? []) as KpiRow[];
    const rows = data
      .filter((r) => (input.technician ? textMatches(r.technician_name, input.technician) : true))
      .filter((r) => (input.branch ? textMatches(r.branch_name, input.branch) : true))
      .slice(0, resolveLimit(input.limit, MAX_TOOL_ROWS))
      .map((r) => ({
        technician: r.technician_name,
        branch: r.branch_name,
        team: r.team_code,
        jobs_completed: n(r.jobs_completed),
        total_amount_myr: n(r.total_amount),
        avg_ticket_myr: n(r.avg_ticket),
        extra_charges_myr: n(r.extra_charges),
        reschedules: n(r.reschedules),
        open_jobs: n(r.open_jobs),
        avg_hours_to_complete: nOrNull(r.avg_hours_to_complete),
        avg_rating: nOrNull(r.avg_rating),
      }));
    const top = rows[0];
    return {
      data: { technicians: rows },
      rows: rows.length,
      summary: `${plural(rows.length, "technician")}${top ? `; top: ${top.technician} (${top.jobs_completed} jobs)` : ""}`,
    };
  }),

  defineTool("get_order_details", orderDetailsSchema, async (input, ctx) => {
    const signal = querySignal(ctx);
    const orderNo = input.order_no.toUpperCase();
    const orderRes = await ctx.supabase
      .from("orders")
      .select(
        "id, order_no, status, customer_name, customer_phone, problem_description, quoted_price, admin_notes, reschedule_count, source, created_at, assigned_at, scheduled_at, started_at, completed_at, reviewed_at, closed_at, service_type:service_types(code, name), technician:technicians(name, team_code), branch:branches(name)",
      )
      .eq("order_no", orderNo)
      .abortSignal(signal)
      .maybeSingle();
    const order = check(orderRes, "order") as OrderDetailRow | null;
    if (!order) {
      return { data: { found: false, note: `No order ${orderNo} exists or you do not have access to it.` }, rows: 0, summary: `${orderNo} not found` };
    }
    const [completion, attachments, reschedules, review, flags] = await Promise.all([
      ctx.supabase
        .from("job_completions")
        .select("work_done, quoted_price, extra_charges, final_amount, remarks, payment_amount, payment_method, completed_at")
        .eq("order_id", order.id)
        .abortSignal(signal)
        .maybeSingle(),
      ctx.supabase.from("order_attachments").select("kind").eq("order_id", order.id).abortSignal(signal),
      ctx.supabase
        .from("reschedules")
        .select("old_scheduled_at, new_scheduled_at, reason, created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(5)
        .abortSignal(signal),
      ctx.supabase.from("reviews").select("rating, decision, notes, created_at").eq("order_id", order.id).abortSignal(signal).maybeSingle(),
      ctx.supabase
        .from("ai_flags")
        .select("rule_code, severity, source, title, explanation")
        .eq("order_id", order.id)
        .eq("resolved", false)
        .limit(10)
        .abortSignal(signal),
    ]);
    const c = check(completion, "completion") as CompletionRow | null;
    const media: Record<string, number> = {};
    for (const a of (check(attachments, "attachment") ?? []) as { kind: string }[]) media[a.kind] = (media[a.kind] ?? 0) + 1;
    const service = one(order.service_type);
    const tech = one(order.technician);
    const ts = (v: string | null) => (v ? formatDateTime(v) : null);
    return {
      data: {
        found: true,
        order_no: order.order_no,
        status: order.status,
        service: service ? `${service.code} – ${service.name}` : null,
        branch: one(order.branch)?.name ?? null,
        technician: tech ? `${tech.name} (${tech.team_code})` : null,
        customer: { name: order.customer_name, phone: maskPhone(order.customer_phone) },
        problem_description: order.problem_description,
        admin_notes: order.admin_notes,
        quoted_price_myr: n(order.quoted_price),
        source: order.source,
        reschedule_count: order.reschedule_count,
        timeline: {
          created: ts(order.created_at),
          assigned: ts(order.assigned_at),
          scheduled: ts(order.scheduled_at),
          started: ts(order.started_at),
          completed: ts(order.completed_at),
          reviewed: ts(order.reviewed_at),
          closed: ts(order.closed_at),
        },
        completion: c
          ? {
              work_done: c.work_done,
              quoted_price_myr: n(c.quoted_price),
              extra_charges_myr: n(c.extra_charges),
              final_amount_myr: n(c.final_amount),
              remarks: c.remarks,
              payment_amount_myr: nOrNull(c.payment_amount),
              payment_method: c.payment_method,
            }
          : null,
        media_counts: media,
        reschedules: ((check(reschedules, "reschedule") ?? []) as RescheduleRow[]).map((r) => ({
          from: ts(r.old_scheduled_at),
          to: ts(r.new_scheduled_at),
          reason: r.reason,
        })),
        review: check(review, "review"),
        open_flags: check(flags, "flag") ?? [],
      },
      rows: 1,
      summary: `${order.order_no} · ${order.status.replace("_", " ")}`,
      records: [{ orderNo: order.order_no, orderId: order.id, label: [service?.name, tech?.name].filter(Boolean).join(" · ") || order.status }],
    };
  }),

  defineTool("workload_analysis", workloadSchema, async (input, ctx) => {
    const result = await ctx.supabase
      .rpc("workload_stats", { p_from: normalizeInstant(input.from), p_to: normalizeInstant(input.to) })
      .abortSignal(querySignal(ctx));
    const data = (check(result, "workload") ?? []) as WorkloadRow[];
    const rows = data.slice(0, MAX_TOOL_ROWS).map((r) => {
      const z = n(r.z_score);
      return {
        technician: r.technician_name,
        branch: r.branch_name,
        jobs_completed: n(r.jobs_completed),
        open_jobs: n(r.open_jobs),
        reschedules: n(r.reschedules),
        z_score: z,
        signal: z >= 1.5 ? "overloaded" : z <= -1.5 ? "underutilised" : "normal",
      };
    });
    const first = data[0];
    const overloaded = rows.filter((r) => r.signal === "overloaded");
    return {
      data: {
        team_mean_jobs: first ? n(first.team_mean) : 0,
        team_stddev: first ? n(first.team_stddev) : 0,
        overload_threshold_z: 1.5,
        technicians: rows,
      },
      rows: rows.length,
      summary: overloaded.length
        ? `${plural(overloaded.length, "technician")} above 1.5σ: ${overloaded.map((r) => r.technician).join(", ")}`
        : `${plural(rows.length, "technician")}, none above 1.5σ`,
    };
  }),

  defineTool("list_flags", listFlagsSchema, async (input, ctx) => {
    let q = ctx.supabase
      .from("ai_flags")
      .select("rule_code, severity, source, title, explanation, recommended_action, created_at, order:orders(id, order_no, status)", { count: "exact" })
      .eq("resolved", false);
    if (input.severity?.length) q = q.in("severity", input.severity);
    const result = await q.order("created_at", { ascending: false }).limit(resolveLimit(input.limit)).abortSignal(querySignal(ctx));
    const data = (check(result, "flag") ?? []) as unknown as FlagRow[];
    const records: CopilotRecord[] = [];
    const counts: Record<FlagSeverity, number> = { high: 0, medium: 0, low: 0 };
    const flags = data.map((f) => {
      const order = one(f.order);
      counts[f.severity] += 1;
      if (order) records.push({ orderNo: order.order_no, orderId: order.id, label: f.title });
      return {
        order_no: order?.order_no ?? null,
        order_status: order?.status ?? null,
        code: f.rule_code,
        severity: f.severity,
        source: f.source,
        title: f.title,
        explanation: f.explanation,
        recommended_action: f.recommended_action,
        raised: formatDateTime(f.created_at),
      };
    });
    const total = result.count ?? flags.length;
    return {
      data: { total_open: total, returned: flags.length, flags },
      rows: flags.length,
      summary: `${plural(total, "open flag")} (${counts.high} high, ${counts.medium} medium, ${counts.low} low shown)`,
      records,
    };
  }),
];

// -------------------------------------------------------------- row types --

type Embedded<T> = T | T[] | null;
interface SearchRow {
  id: string;
  order_no: string;
  status: OrderStatus;
  customer_name: string;
  quoted_price: number | string;
  created_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
  reschedule_count: number;
  service_type: Embedded<{ code: string; name: string }>;
  technician: Embedded<{ name: string }>;
  branch: Embedded<{ name: string }>;
  completion: Embedded<{ final_amount: number | string; extra_charges: number | string; payment_method: string | null }>;
}
interface CountRow {
  id: string;
  status: OrderStatus;
  created_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
  assigned_technician_id: string | null;
  service_type_id: number;
  branch_id: number | null;
  completion: Embedded<{ final_amount: number | string }>;
}
interface KpiRow {
  technician_name: string;
  branch_name: string;
  team_code: string;
  jobs_completed: number | string;
  total_amount: number | string;
  extra_charges: number | string;
  avg_ticket: number | string;
  reschedules: number | string;
  open_jobs: number | string;
  avg_hours_to_complete: number | string | null;
  avg_rating: number | string | null;
}
interface WorkloadRow {
  technician_name: string;
  branch_name: string;
  jobs_completed: number | string;
  open_jobs: number | string;
  reschedules: number | string;
  team_mean: number | string;
  team_stddev: number | string;
  z_score: number | string;
}
interface OrderDetailRow {
  id: string;
  order_no: string;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  problem_description: string;
  quoted_price: number | string;
  admin_notes: string | null;
  reschedule_count: number;
  source: string;
  created_at: string;
  assigned_at: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  closed_at: string | null;
  service_type: Embedded<{ code: string; name: string }>;
  technician: Embedded<{ name: string; team_code: string }>;
  branch: Embedded<{ name: string }>;
}
interface CompletionRow {
  work_done: string;
  quoted_price: number | string;
  extra_charges: number | string;
  final_amount: number | string;
  remarks: string | null;
  payment_amount: number | string | null;
  payment_method: string | null;
  completed_at: string;
}
interface RescheduleRow {
  old_scheduled_at: string | null;
  new_scheduled_at: string;
  reason: string;
}
interface FlagRow {
  rule_code: string;
  severity: FlagSeverity;
  source: string;
  title: string;
  explanation: string;
  recommended_action: string | null;
  created_at: string;
  order: Embedded<{ id: string; order_no: string; status: OrderStatus }>;
}

// ----------------------------------------------------------------- factory --

let syntheticId = 0;

/**
 * Build the runnable tool set for one agent run. Each tool:
 *  - is validated by its Zod schema before running (invalid calls are traced too),
 *  - runs a fixed, parameterised, read-only query with the caller's RLS-scoped client,
 *  - is row-capped and trimmed, and reports name/input/rows/latency to the trace.
 */
export function buildCopilotTools(ctx: ToolContext): BetaRunnableTool[] {
  const ref = referenceLoader(ctx);
  const descriptions = new Map(TOOL_CATALOGUE.map((t) => [t.name, t.description]));

  return TOOL_IMPLS.map(({ name, schema, impl }) => {
    const tool = betaZodTool({
      name,
      description: descriptions.get(name) ?? name,
      inputSchema: schema,
      eager_input_streaming: true,
      run: async (input, runCtx) => {
        const id = runCtx?.toolUse.id ?? `call_${++syntheticId}`;
        ctx.hooks.onCall({ id, name, input });
        const started = performance.now();
        try {
          const out = await impl(input, ctx, ref);
          const ms = Math.round(performance.now() - started);
          ctx.trace.push({ name, input, ok: true, rows: out.rows, ms });
          for (const r of out.records ?? []) if (!ctx.records.has(r.orderNo)) ctx.records.set(r.orderNo, r);
          ctx.hooks.onResult({ id, name, ok: true, rows: out.rows, ms, summary: out.summary });
          return JSON.stringify(out.data);
        } catch (err) {
          const ms = Math.round(performance.now() - started);
          const message =
            err instanceof ToolQueryError
              ? err.message
              : ctx.signal.aborted
                ? "The query was cancelled."
                : err instanceof Error && err.name === "TimeoutError"
                  ? "The query timed out."
                  : "The query failed unexpectedly.";
          if (!(err instanceof ToolQueryError)) console.error(`[ai] tool ${name} failed`, err);
          ctx.trace.push({ name, input, ok: false, rows: 0, ms, error: message });
          ctx.hooks.onResult({ id, name, ok: false, rows: 0, ms, summary: message });
          throw new Error(message);
        }
      },
    });

    // Trace calls the schema rejects (the runner never reaches run() for those).
    const parse = tool.parse;
    return {
      ...tool,
      parse: (raw: unknown) => {
        try {
          return parse(raw);
        } catch (err) {
          const id = `invalid_${++syntheticId}`;
          const message = "Invalid tool input";
          ctx.trace.push({ name, input: raw, ok: false, rows: 0, ms: 0, error: err instanceof Error ? err.message.slice(0, 500) : message });
          ctx.hooks.onCall({ id, name, input: raw });
          ctx.hooks.onResult({ id, name, ok: false, rows: 0, ms: 0, summary: message });
          throw err;
        }
      },
    } satisfies BetaRunnableTool;
  });
}
