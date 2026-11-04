import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

/**
 * Data for the manager's review workspace. Nothing here depends on notifications: every
 * job that needs a decision, every approved job waiting to be closed and every past
 * decision is reachable from these lists.
 */

export type ReviewTab = "awaiting" | "close" | "sent-back" | "history";
export const REVIEW_TABS: ReviewTab[] = ["awaiting", "close", "sent-back", "history"];

type Embedded<T> = T | T[] | null;
const one = <T,>(v: Embedded<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function getTabCounts() {
  const supabase = await createClient();
  const [awaiting, close, sentBack] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "job_done"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "reviewed"),
    supabase
      .from("orders")
      .select("id, reviews!inner(decision)", { count: "exact", head: true })
      .eq("status", "in_progress")
      .eq("reviews.decision", "rework"),
  ]);
  return { awaiting: awaiting.count ?? 0, close: close.count ?? 0, "sent-back": sentBack.count ?? 0 } as Record<Exclude<ReviewTab, "history">, number>;
}

// ------------------------------------------------------------ ready to close --

export type PaymentState = "paid" | "unpaid" | "short";

export interface ReadyItem {
  id: string;
  orderNo: string;
  customer: string;
  service: string;
  technician: string;
  final: number;
  paid: number | null;
  paymentMethod: string | null;
  payment: PaymentState;
  rating: number | null;
  notes: string | null;
  approvedBy: string;
  reviewedAt: string | null;
}

export async function getReadyToClose(): Promise<ReadyItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_no, customer_name, reviewed_at, service_type:service_types(name), technician:technicians(name), completion:job_completions(final_amount, payment_amount, payment_method), review:reviews(rating, notes, manager:profiles(full_name))",
    )
    .eq("status", "reviewed")
    .order("reviewed_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(`Could not load approved jobs: ${error.message}`);
  return (data ?? []).map((o) => {
    const c = one(o.completion as Embedded<{ final_amount: number; payment_amount: number | null; payment_method: string | null }>);
    const r = one(o.review as Embedded<{ rating: number | null; notes: string | null; manager: Embedded<{ full_name: string }> }>);
    const final = num(c?.final_amount) ?? 0;
    const paid = num(c?.payment_amount);
    const payment: PaymentState =
      paid === null || c?.payment_method === "unpaid" ? "unpaid" : paid + 0.005 < final ? "short" : "paid";
    return {
      id: o.id,
      orderNo: o.order_no,
      customer: o.customer_name,
      service: one(o.service_type as Embedded<{ name: string }>)?.name ?? "Service",
      technician: one(o.technician as Embedded<{ name: string }>)?.name ?? "—",
      final,
      paid,
      paymentMethod: c?.payment_method ?? null,
      payment,
      rating: r?.rating ?? null,
      notes: r?.notes ?? null,
      approvedBy: one(r?.manager ?? null)?.full_name ?? "—",
      reviewedAt: o.reviewed_at,
    };
  });
}

// ---------------------------------------------------------------- sent back --

export interface SentBackItem {
  id: string;
  orderNo: string;
  customer: string;
  service: string;
  technician: string;
  notes: string | null;
  sentBy: string;
  sentAt: string;
}

export async function getSentBack(): Promise<SentBackItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_no, customer_name, service_type:service_types(name), technician:technicians(name), review:reviews!inner(decision, notes, created_at, manager:profiles(full_name))",
    )
    .eq("status", "in_progress")
    .eq("review.decision", "rework")
    .limit(300);
  if (error) throw new Error(`Could not load jobs sent back: ${error.message}`);
  return (data ?? [])
    .map((o) => {
      const r = one(o.review as Embedded<{ notes: string | null; created_at: string; manager: Embedded<{ full_name: string }> }>)!;
      return {
        id: o.id,
        orderNo: o.order_no,
        customer: o.customer_name,
        service: one(o.service_type as Embedded<{ name: string }>)?.name ?? "Service",
        technician: one(o.technician as Embedded<{ name: string }>)?.name ?? "—",
        notes: r.notes,
        sentBy: one(r.manager)?.full_name ?? "—",
        sentAt: r.created_at,
      };
    })
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

// --------------------------------------------------------- decision history --
// From the append-only, hash-chained audit trail: every approval, rework and close is kept
// (the reviews table only holds the latest decision per order).

export type DecisionKind = "all" | "approved" | "rework" | "closed";
export type DecisionWho = "all" | "me";
export type DecisionRange = "7d" | "30d" | "90d" | "all";

export interface HistoryFilters {
  q: string;
  decision: DecisionKind;
  who: DecisionWho;
  range: DecisionRange;
  page: number;
}

export const HISTORY_PAGE_SIZE = 25;
const ACTION: Record<Exclude<DecisionKind, "all">, string> = { approved: "job_reviewed", rework: "rework_requested", closed: "job_closed" };
const KIND_OF: Record<string, Exclude<DecisionKind, "all">> = { job_reviewed: "approved", rework_requested: "rework", job_closed: "closed" };

export function parseHistoryFilters(sp: Record<string, string | string[] | undefined>): HistoryFilters {
  const first = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const decision = first("decision");
  const who = first("who");
  const range = first("range");
  const page = Number.parseInt(first("page"), 10);
  return {
    q: first("q").trim().slice(0, 80),
    decision: (["approved", "rework", "closed"].includes(decision) ? decision : "all") as DecisionKind,
    who: who === "me" ? "me" : "all",
    range: (["7d", "90d", "all"].includes(range) ? range : "30d") as DecisionRange,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 400) : 1,
  };
}

export interface DecisionRow {
  id: number;
  kind: Exclude<DecisionKind, "all">;
  at: string;
  by: string;
  byRole: string | null;
  rating: number | null;
  notes: string | null;
  orderId: string;
  orderNo: string;
  customer: string;
  technician: string;
  final: number | null;
  status: OrderStatus;
}

function rangeStart(range: DecisionRange): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  return new Date(Date.now() - days * 864e5).toISOString();
}

/**
 * Builds the filtered decision query; `select` lets the export reuse it. Wrapped in an object:
 * a Postgrest builder is thenable, so returning it bare from an async function would run it.
 */
async function decisionQuery(f: HistoryFilters, userId: string, select: string, opts?: { count: "exact" }) {
  const supabase = await createClient();
  let orderIds: string[] | null = null;
  if (f.q) {
    // Order search goes through search_orders (ranked, typo-tolerant, RLS-scoped).
    const { data } = await supabase.rpc("search_orders", { p_query: f.q, p_limit: 50 });
    orderIds = ((data ?? []) as { id: string }[]).map((r) => r.id);
  }
  let q = supabase
    .from("order_events")
    .select(select, opts)
    .in("action", f.decision === "all" ? Object.values(ACTION) : [ACTION[f.decision]]);
  const from = rangeStart(f.range);
  if (from) q = q.gte("created_at", from);
  if (f.who === "me") q = q.eq("actor_id", userId);
  if (orderIds) q = q.in("order_id", orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"]);
  return { q };
}

const HISTORY_SELECT =
  "id, action, actor_name, actor_role, payload, created_at, order:orders(id, order_no, customer_name, status, technician:technicians(name), completion:job_completions(final_amount))";

function toRow(e: Record<string, unknown>): DecisionRow {
  const o = one(e.order as Embedded<{ id: string; order_no: string; customer_name: string; status: OrderStatus; technician: Embedded<{ name: string }>; completion: Embedded<{ final_amount: number }> }>);
  const p = (e.payload ?? {}) as { rating?: number | null; notes?: string | null };
  return {
    id: e.id as number,
    kind: KIND_OF[e.action as string] ?? "approved",
    at: e.created_at as string,
    by: (e.actor_name as string) ?? "—",
    byRole: (e.actor_role as string | null) ?? null,
    rating: typeof p.rating === "number" ? p.rating : null,
    notes: p.notes ? String(p.notes) : null,
    orderId: o?.id ?? "",
    orderNo: o?.order_no ?? "—",
    customer: o?.customer_name ?? "—",
    technician: one(o?.technician ?? null)?.name ?? "—",
    final: num(one(o?.completion ?? null)?.final_amount),
    status: o?.status ?? "closed",
  };
}

export async function getDecisionHistory(f: HistoryFilters, userId: string) {
  const from = (f.page - 1) * HISTORY_PAGE_SIZE;
  const { q: list } = await decisionQuery(f, userId, HISTORY_SELECT, { count: "exact" });
  const countFor = async (kind: Exclude<DecisionKind, "all">) => {
    const { q } = await decisionQuery({ ...f, decision: kind }, userId, "id", { count: "exact" });
    const { count } = await q.limit(1);
    return count ?? 0;
  };
  const [rows, approved, rework, closed] = await Promise.all([
    list.order("created_at", { ascending: false }).range(from, from + HISTORY_PAGE_SIZE - 1),
    countFor("approved"),
    countFor("rework"),
    countFor("closed"),
  ]);
  if (rows.error) throw new Error(`Could not load decisions: ${rows.error.message}`);
  const total = rows.count ?? 0;
  return {
    rows: ((rows.data ?? []) as unknown as Record<string, unknown>[]).map(toRow),
    total,
    pages: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
    counts: { approved, rework, closed },
  };
}

/** Up to 5,000 decisions for CSV export, same filters. */
export async function exportDecisionHistory(f: HistoryFilters, userId: string): Promise<DecisionRow[]> {
  const { q } = await decisionQuery(f, userId, HISTORY_SELECT);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(5000);
  if (error) throw new Error(`Could not export decisions: ${error.message}`);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toRow);
}
