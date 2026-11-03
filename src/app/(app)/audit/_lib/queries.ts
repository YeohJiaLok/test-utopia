import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AiToolCall, AppRole } from "@/lib/types";
import { ACTIONS, EXPORT_ROW_CAP, resolveRange, sanitizeSearch, type AuditFilters, type ResolvedRange } from "./filters";
import { actionsMatching } from "./labels";
import { buildVolume } from "./volume";
import type { AuditEventRow, AuditKpi, AuditPageData, AuditRunRow, UserAdminEventRow } from "./types";

/**
 * Audit queries. Everything goes through the user-scoped client, so RLS decides visibility
 * (office staff only for ai_runs / user_admin_events; order visibility for order_events).
 * Filters are applied with parameterised PostgREST operators — never raw SQL.
 */

type Row = Record<string, unknown>;
type Client = Awaited<ReturnType<typeof createClient>>;

/** PostgREST caps a single response at 1,000 rows; larger reads are paged. */
const PAGE = 1000;
/** Rows aggregated for KPI tiles and the volume chart. */
const KPI_ROW_CAP = 10_000;
/** A UUID that matches nothing — keeps `in (...)` valid when a lookup came back empty. */
const NO_MATCH = "00000000-0000-0000-0000-000000000000";

const SELECT = {
  events: "id, order_id, actor_id, actor_name, actor_role, action, from_status, to_status, payload, created_at, order:orders(order_no, customer_name)",
  ai: "id, kind, user_id, input, tool_calls, output, model, input_tokens, output_tokens, latency_ms, status, error, created_at, user:profiles(full_name, role)",
  users:
    "id, actor_id, actor_name, action, target_id, target_name, target_email, changes, created_at, actor:profiles!user_admin_events_actor_id_fkey(role)",
} as const;

const KPI_SELECT = {
  events: "actor_id, actor_name, order_id, action, created_at",
  ai: "status, latency_ms, input_tokens, output_tokens, created_at",
  users: "target_id, target_name, action, created_at",
} as const;

const TABLE = { events: "order_events", ai: "ai_runs", users: "user_admin_events" } as const;

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}: ${error?.message ?? "unknown error"}`);
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// ------------------------------------------------------------ query scope ---

interface ScopeContext {
  range: ResolvedRange;
  term: string;
  /** Extra `or` clauses resolved from lookups (matching orders / users). */
  orClauses: string[];
  /** Restricts ai_runs.user_id when filtering AI runs by a human role. */
  userIds: string[] | null;
}

async function resolveContext(supabase: Client, f: AuditFilters): Promise<ScopeContext> {
  const range = resolveRange(f);
  const term = sanitizeSearch(f.q);
  const orClauses: string[] = [];
  let userIds: string[] | null = null;

  const lookups: PromiseLike<void>[] = [];

  if (term && f.tab === "events") {
    lookups.push(
      supabase
        .from("orders")
        .select("id")
        .or(`order_no.ilike.%${term}%,customer_name.ilike.%${term}%`)
        .limit(200)
        .then(({ data, error }) => {
          if (error) fail("matching orders", error);
          const ids = (data ?? []).map((r) => r.id as string);
          if (ids.length) orClauses.push(`order_id.in.(${ids.join(",")})`);
        }),
    );
  }
  if (term && f.tab === "ai") {
    lookups.push(
      supabase
        .from("profiles")
        .select("id")
        .ilike("full_name", `%${term}%`)
        .limit(200)
        .then(({ data, error }) => {
          if (error) fail("matching users", error);
          const ids = (data ?? []).map((r) => r.id as string);
          if (ids.length) orClauses.push(`user_id.in.(${ids.join(",")})`);
        }),
    );
  }
  if (f.tab === "ai" && f.role && f.role !== "system") {
    lookups.push(
      supabase
        .from("profiles")
        .select("id")
        .eq("role", f.role)
        .limit(1000)
        .then(({ data, error }) => {
          if (error) fail("users by role", error);
          userIds = (data ?? []).map((r) => r.id as string);
        }),
    );
  }
  await Promise.all(lookups);
  return { range, term, orClauses, userIds };
}

/** The filtered (unordered, unpaged) query for the active tab. */
function scoped(supabase: Client, f: AuditFilters, ctx: ScopeContext, select: string, count?: "exact") {
  let q = supabase.from(TABLE[f.tab]).select(select, count ? { count } : undefined);
  if (ctx.range.from) q = q.gte("created_at", ctx.range.from);
  if (ctx.range.to) q = q.lt("created_at", ctx.range.to);
  if (f.action) q = q.eq(f.tab === "ai" ? "kind" : "action", f.action);

  const like = `%${ctx.term}%`;
  switch (f.tab) {
    case "events": {
      if (f.role === "system") q = q.is("actor_role", null);
      else if (f.role) q = q.eq("actor_role", f.role);
      if (ctx.term) {
        const actions = actionsMatching("events", ACTIONS.events, ctx.term);
        const clauses = [`actor_name.ilike.${like}`, ...ctx.orClauses];
        if (actions.length) clauses.push(`action.in.(${actions.join(",")})`);
        q = q.or(clauses.join(","));
      }
      break;
    }
    case "ai": {
      if (f.status) q = q.eq("status", f.status);
      if (f.role === "system") q = q.is("user_id", null);
      else if (ctx.userIds) q = q.in("user_id", ctx.userIds.length ? ctx.userIds : [NO_MATCH]);
      if (ctx.term) {
        const clauses = [`input.ilike.${like}`, `output.ilike.${like}`, `model.ilike.${like}`, `error.ilike.${like}`, ...ctx.orClauses];
        q = q.or(clauses.join(","));
      }
      break;
    }
    case "users": {
      if (ctx.term) {
        const actions = actionsMatching("users", ACTIONS.users, ctx.term);
        const clauses = [`target_name.ilike.${like}`, `target_email.ilike.${like}`, `actor_name.ilike.${like}`];
        if (actions.length) clauses.push(`action.in.(${actions.join(",")})`);
        q = q.or(clauses.join(","));
      }
      break;
    }
  }
  return q;
}

/** Reads up to `cap` rows newest-first, paging past PostgREST's 1,000-row response limit. */
async function readCapped(build: () => ReturnType<typeof scoped>, cap: number, what: string) {
  const rows: Row[] = [];
  for (let offset = 0; offset < cap; offset += PAGE) {
    const { data, error } = await build()
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, Math.min(offset + PAGE, cap) - 1);
    if (error) fail(what, error);
    const batch = (data ?? []) as unknown as Row[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

// ---------------------------------------------------------------- mappers ---

function mapEvent(r: Row): AuditEventRow {
  const order = one(r.order as { order_no: string; customer_name: string } | null);
  return {
    id: Number(r.id),
    order_id: r.order_id as string,
    actor_id: (r.actor_id as string | null) ?? null,
    actor_name: (r.actor_name as string | null) ?? null,
    actor_role: (r.actor_role as AppRole | null) ?? null,
    action: r.action as string,
    from_status: (r.from_status as AuditEventRow["from_status"]) ?? null,
    to_status: (r.to_status as AuditEventRow["to_status"]) ?? null,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    created_at: r.created_at as string,
    order_no: order?.order_no ?? null,
    customer_name: order?.customer_name ?? null,
  };
}

function mapRun(r: Row): AuditRunRow {
  const user = one(r.user as { full_name: string; role: AppRole } | null);
  return {
    id: r.id as string,
    kind: r.kind as AuditRunRow["kind"],
    user_id: (r.user_id as string | null) ?? null,
    input: (r.input as string | null) ?? null,
    tool_calls: (Array.isArray(r.tool_calls) ? r.tool_calls : []) as AiToolCall[],
    output: (r.output as string | null) ?? null,
    model: (r.model as string | null) ?? null,
    input_tokens: numOrNull(r.input_tokens),
    output_tokens: numOrNull(r.output_tokens),
    latency_ms: numOrNull(r.latency_ms),
    status: r.status as AuditRunRow["status"],
    error: (r.error as string | null) ?? null,
    created_at: r.created_at as string,
    user_name: user?.full_name ?? null,
    user_role: user?.role ?? null,
  };
}

function mapUserEvent(r: Row): UserAdminEventRow {
  const actor = one(r.actor as { role: AppRole } | null);
  return {
    id: Number(r.id),
    actor_id: (r.actor_id as string | null) ?? null,
    actor_name: r.actor_name as string,
    actor_role: actor?.role ?? null,
    action: r.action as UserAdminEventRow["action"],
    target_id: (r.target_id as string | null) ?? null,
    target_name: r.target_name as string,
    target_email: (r.target_email as string | null) ?? null,
    changes: (r.changes ?? {}) as UserAdminEventRow["changes"],
    created_at: r.created_at as string,
  };
}

// ------------------------------------------------------------------- KPIs ---

const distinct = (values: unknown[]) => new Set(values.filter((v) => v !== null && v !== undefined && v !== "")).size;

function kpisFor(f: AuditFilters, total: number, rows: Row[]): AuditKpi[] {
  switch (f.tab) {
    case "events": {
      const exceptions = rows.filter((r) => r.action === "rework_requested" || r.action === "job_rescheduled");
      const reworks = exceptions.filter((r) => r.action === "rework_requested").length;
      return [
        { key: "total", label: "Events", value: total, format: "number", hint: "Workflow transitions logged" },
        { key: "orders", label: "Orders touched", value: distinct(rows.map((r) => r.order_id)), format: "number" },
        {
          key: "actors",
          label: "Distinct actors",
          value: distinct(rows.map((r) => r.actor_id ?? r.actor_name ?? "system")),
          format: "number",
        },
        {
          key: "exceptions",
          label: "Exceptions",
          value: exceptions.length,
          format: "number",
          hint: `${reworks} rework · ${exceptions.length - reworks} reschedule`,
          tone: exceptions.length ? "warning" : "default",
        },
      ];
    }
    case "ai": {
      const failed = rows.filter((r) => r.status !== "ok").length;
      const lat = rows
        .map((r) => r.latency_ms)
        .filter((v): v is number => v !== null && v !== undefined)
        .map(Number)
        .sort((a, b) => a - b);
      const avg = lat.length ? lat.reduce((s, v) => s + v, 0) / lat.length : null;
      const p95 = lat.length ? lat[Math.min(lat.length - 1, Math.ceil(lat.length * 0.95) - 1)]! : null;
      const tin = rows.reduce((s, r) => s + Number(r.input_tokens ?? 0), 0);
      const tout = rows.reduce((s, r) => s + Number(r.output_tokens ?? 0), 0);
      return [
        { key: "total", label: "AI runs", value: total, format: "number", hint: "Model calls logged" },
        {
          key: "failures",
          label: "Error / refusal rate",
          value: rows.length ? failed / rows.length : null,
          format: "percent",
          hint: `${failed.toLocaleString("en-MY")} not ok`,
          tone: failed ? "warning" : "default",
        },
        {
          key: "latency",
          label: "Avg latency",
          value: avg,
          format: "seconds",
          hint: p95 !== null ? `p95 ${(p95 / 1000).toFixed(1)} s` : undefined,
        },
        {
          key: "tokens",
          label: "Tokens",
          value: tin + tout,
          format: "compact",
          hint: `${compact(tin)} in · ${compact(tout)} out`,
        },
      ];
    }
    case "users": {
      const deact = rows.filter((r) => r.action === "user_deactivated").length;
      const react = rows.filter((r) => r.action === "user_reactivated").length;
      return [
        { key: "total", label: "Account changes", value: total, format: "number", hint: "Passwords never recorded" },
        { key: "accounts", label: "Accounts affected", value: distinct(rows.map((r) => r.target_id ?? r.target_name)), format: "number" },
        { key: "roles", label: "Role changes", value: rows.filter((r) => r.action === "role_changed").length, format: "number" },
        {
          key: "deactivations",
          label: "Deactivations",
          value: deact,
          format: "number",
          hint: `${react} reactivated`,
          tone: deact ? "warning" : "default",
        },
      ];
    }
  }
}

function compact(n: number) {
  return new Intl.NumberFormat("en-MY", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

// ----------------------------------------------------------------- public ---

export async function getAuditPage(f: AuditFilters): Promise<AuditPageData> {
  const supabase = await createClient();
  const ctx = await resolveContext(supabase, f);
  const what = f.tab === "events" ? "order events" : f.tab === "ai" ? "AI runs" : "user management events";

  const pageQuery = (page: number) =>
    scoped(supabase, f, ctx, SELECT[f.tab], "exact")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * f.size, page * f.size - 1);

  const [first, kpiRows] = await Promise.all([
    pageQuery(f.page),
    readCapped(() => scoped(supabase, f, ctx, KPI_SELECT[f.tab]), KPI_ROW_CAP, what),
  ]);

  let res = first;
  let page = f.page;
  const total = res.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / f.size));
  // An out-of-range page (e.g. an old link after filters narrowed) lands on the last page,
  // or on page 1 when PostgREST rejects the offset outright.
  if (page > pages || (res.error && page > 1)) {
    page = Math.min(page, pages);
    res = await pageQuery(page);
  }
  if (res.error) fail(what, res.error);

  const data = (res.data ?? []) as unknown as Row[];
  const base = {
    filters: { ...f, page },
    range: ctx.range,
    total,
    page,
    pages,
    kpis: kpisFor(f, total, kpiRows),
    volume: buildVolume(
      kpiRows.map((r) => r.created_at as string),
      ctx.range,
    ),
    capped: total > kpiRows.length,
  };

  switch (f.tab) {
    case "events":
      return { ...base, tab: "events", rows: data.map(mapEvent) };
    case "ai":
      return { ...base, tab: "ai", rows: data.map(mapRun) };
    case "users":
      return { ...base, tab: "users", rows: data.map(mapUserEvent) };
  }
}

export type AuditExport =
  | { tab: "events"; rows: AuditEventRow[]; total: number; range: ResolvedRange }
  | { tab: "ai"; rows: AuditRunRow[]; total: number; range: ResolvedRange }
  | { tab: "users"; rows: UserAdminEventRow[]; total: number; range: ResolvedRange };

/** Every row of the filtered view, newest first, up to EXPORT_ROW_CAP. */
export async function getAuditExport(f: AuditFilters): Promise<AuditExport> {
  const supabase = await createClient();
  const ctx = await resolveContext(supabase, f);
  const [countRes, rows] = await Promise.all([
    scoped(supabase, f, ctx, "id", "exact").limit(1),
    readCapped(() => scoped(supabase, f, ctx, SELECT[f.tab]), EXPORT_ROW_CAP, "audit export"),
  ]);
  const total = countRes.count ?? rows.length;
  switch (f.tab) {
    case "events":
      return { tab: "events", rows: rows.map(mapEvent), total, range: ctx.range };
    case "ai":
      return { tab: "ai", rows: rows.map(mapRun), total, range: ctx.range };
    case "users":
      return { tab: "users", rows: rows.map(mapUserEvent), total, range: ctx.range };
  }
}
