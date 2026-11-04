import { TZDate } from "@date-fns/tz";
import { addDays, format, startOfDay } from "date-fns";
import { TIMEZONE } from "@/lib/format";

/**
 * URL-backed filter state for /audit. Pure and client-safe: the page, the toolbar and the
 * CSV export route all parse the same search params, so a shared link, the back button and
 * an export always describe the same slice of the ledger.
 */

export type AuditTab = "events" | "ai" | "users";
export type AuditRangeKey = "today" | "7d" | "30d" | "90d" | "all" | "custom";
export type AuditRole = "admin" | "manager" | "technician" | "system";
export type AiStatus = "ok" | "error" | "refused" | "blocked";

export interface AuditFilters {
  tab: AuditTab;
  q: string;
  action: string;
  role: AuditRole | "";
  status: AiStatus | "";
  range: AuditRangeKey;
  from: string; // YYYY-MM-DD (MYT), custom range only
  to: string; // YYYY-MM-DD (MYT), inclusive, custom range only
  page: number;
  size: number;
}

export const AUDIT_TABS: AuditTab[] = ["events", "ai", "users"];
export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
export const DEFAULT_RANGE: AuditRangeKey = "30d";
export const EXPORT_ROW_CAP = 5000;

export const RANGE_OPTIONS: { key: Exclude<AuditRangeKey, "custom">; label: string; short: string }[] = [
  { key: "today", label: "Today", short: "Today" },
  { key: "7d", label: "Last 7 days", short: "7d" },
  { key: "30d", label: "Last 30 days", short: "30d" },
  { key: "90d", label: "Last 90 days", short: "90d" },
  { key: "all", label: "All time", short: "All" },
];

/** Allowed values of `action` per tab (order events: action; AI: kind; users: action). */
export const ACTIONS: Record<AuditTab, readonly string[]> = {
  events: [
    "order_created",
    "technician_assigned",
    "technician_reassigned",
    "job_started",
    "job_completed",
    "job_reviewed",
    "rework_requested",
    "job_closed",
    "job_rescheduled",
  ],
  ai: ["copilot", "supervisor", "extraction", "insight"],
  users: ["user_created", "user_updated", "role_changed", "user_deactivated", "user_reactivated", "password_reset", "mfa_enabled", "mfa_disabled", "mfa_reset"],
};

export const ROLES: AuditRole[] = ["admin", "manager", "technician", "system"];
export const AI_STATUSES: AiStatus[] = ["ok", "error", "refused", "blocked"];

type SearchParams = Record<string, string | string[] | undefined> | URLSearchParams;

function first(sp: SearchParams, key: string): string {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? "";
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function parseAuditFilters(sp: SearchParams): AuditFilters {
  const rawTab = first(sp, "tab");
  const tab: AuditTab = (AUDIT_TABS as string[]).includes(rawTab) ? (rawTab as AuditTab) : "events";

  const action = first(sp, "action");
  const role = first(sp, "role");
  const status = first(sp, "status");

  let range = first(sp, "range") as AuditRangeKey;
  let from = first(sp, "from");
  let to = first(sp, "to");
  if (range === "custom") {
    if (!isIsoDate(from) && !isIsoDate(to)) range = DEFAULT_RANGE;
    if (!isIsoDate(from)) from = "";
    if (!isIsoDate(to)) to = "";
    if (from && to && from > to) [from, to] = [to, from];
  } else {
    if (!RANGE_OPTIONS.some((r) => r.key === range)) range = DEFAULT_RANGE;
    from = "";
    to = "";
  }

  const page = Number.parseInt(first(sp, "page"), 10);
  const size = Number.parseInt(first(sp, "size"), 10);

  return {
    tab,
    q: first(sp, "q").trim().slice(0, 80),
    action: ACTIONS[tab].includes(action) ? action : "",
    role: tab !== "users" && (ROLES as string[]).includes(role) ? (role as AuditRole) : "",
    status: tab === "ai" && (AI_STATUSES as string[]).includes(status) ? (status as AiStatus) : "",
    range,
    from,
    to,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/** Search params for the given filters (defaults omitted so URLs stay short). */
export function auditParams(f: AuditFilters, opts: { paging?: boolean } = {}) {
  const params = new URLSearchParams();
  if (f.tab !== "events") params.set("tab", f.tab);
  if (f.q) params.set("q", f.q);
  if (f.action) params.set("action", f.action);
  if (f.role) params.set("role", f.role);
  if (f.status) params.set("status", f.status);
  if (f.range !== DEFAULT_RANGE) params.set("range", f.range);
  if (f.range === "custom") {
    if (f.from) params.set("from", f.from);
    if (f.to) params.set("to", f.to);
  }
  if (opts.paging !== false) {
    if (f.page > 1) params.set("page", String(f.page));
    if (f.size !== DEFAULT_PAGE_SIZE) params.set("size", String(f.size));
  }
  return params;
}

/**
 * Builds /audit?… from the current filters plus a patch. Paging resets unless the patch sets it;
 * switching tab drops the tab-specific filters (action / role / status) but keeps search and range.
 */
export function auditHref(current: AuditFilters, patch: Partial<AuditFilters> = {}) {
  const next: AuditFilters = { ...current, page: 1, ...patch };
  if (patch.tab && patch.tab !== current.tab) {
    next.action = patch.action ?? "";
    next.role = patch.role ?? "";
    next.status = patch.status ?? "";
  }
  if (next.range !== "custom") {
    next.from = "";
    next.to = "";
  }
  const qs = auditParams(next).toString();
  return qs ? `/audit?${qs}` : "/audit";
}

/** Same slice of the ledger as the page, without paging. */
export function auditExportHref(f: AuditFilters) {
  const qs = auditParams(f, { paging: false }).toString();
  return qs ? `/audit/export?${qs}` : "/audit/export";
}

export function activeFilterCount(f: AuditFilters) {
  return [f.q, f.action, f.role, f.status, f.range !== DEFAULT_RANGE ? f.range : ""].filter(Boolean).length;
}

// ------------------------------------------------------------------ ranges ---

export interface ResolvedRange {
  from: string | null; // ISO instant, inclusive
  to: string | null; // ISO instant, exclusive
  label: string;
}

function mytMidnight(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  return new TZDate(y, m - 1, d, TIMEZONE);
}

/** UTC "Z" ISO string (TZDate.toISOString keeps the zone offset). */
const iso = (d: Date) => new Date(d.getTime()).toISOString();

function shortDate(isoDate: string) {
  return format(mytMidnight(isoDate), "d MMM yyyy");
}

/** Half-open [from, to) instants for the filter's range, bucketed by Malaysia-time days. */
export function resolveRange(f: Pick<AuditFilters, "range" | "from" | "to">, now: Date = new Date()): ResolvedRange {
  const today = startOfDay(new TZDate(now, TIMEZONE));
  const tomorrow = iso(addDays(today, 1));
  switch (f.range) {
    case "today":
      return { from: iso(today), to: tomorrow, label: "Today" };
    case "7d":
      return { from: iso(addDays(today, -6)), to: tomorrow, label: "Last 7 days" };
    case "30d":
      return { from: iso(addDays(today, -29)), to: tomorrow, label: "Last 30 days" };
    case "90d":
      return { from: iso(addDays(today, -89)), to: tomorrow, label: "Last 90 days" };
    case "all":
      return { from: null, to: null, label: "All time" };
    case "custom": {
      const from = f.from ? iso(mytMidnight(f.from)) : null;
      const to = f.to ? iso(addDays(mytMidnight(f.to), 1)) : null;
      const label =
        f.from && f.to
          ? f.from === f.to
            ? shortDate(f.from)
            : `${shortDate(f.from)} – ${shortDate(f.to)}`
          : f.from
            ? `Since ${shortDate(f.from)}`
            : `Until ${shortDate(f.to)}`;
      return { from, to, label };
    }
  }
}

// ------------------------------------------------------------------ search ---

/**
 * Makes a free-text term safe to embed in a PostgREST `or=(…)` filter: strips the
 * characters that are syntax there (commas, parentheses, quotes, backslashes) and
 * the LIKE wildcards, collapses whitespace. Values are still sent as URL parameters,
 * never concatenated into SQL.
 */
export function sanitizeSearch(q: string) {
  return q
    .replace(/[%*,()"'\\:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

// -------------------------------------------------------------------- days ---

/** Malaysia-time calendar day of an instant, as YYYY-MM-DD. */
export function mytDayKey(value: string | Date) {
  return format(new TZDate(typeof value === "string" ? new Date(value) : value, TIMEZONE), "yyyy-MM-dd");
}

/** "Today" / "Yesterday" / "Mon, 2 Nov 2026" for a YYYY-MM-DD key. */
export function dayLabel(key: string, now: Date = new Date()) {
  const today = mytDayKey(now);
  if (key === today) return "Today";
  if (key === mytDayKey(addDays(new TZDate(now, TIMEZONE), -1))) return "Yesterday";
  return format(mytMidnight(key), "EEE, d MMM yyyy");
}

/** Groups already-sorted rows into consecutive Malaysia-time days. */
export function groupByDay<T extends { created_at: string }>(rows: T[]) {
  const groups: { key: string; rows: T[] }[] = [];
  for (const row of rows) {
    const key = mytDayKey(row.created_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else groups.push({ key, rows: [row] });
  }
  return groups;
}
