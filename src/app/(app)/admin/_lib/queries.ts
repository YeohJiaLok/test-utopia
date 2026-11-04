import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ORDER_SELECT, normalizeOrder } from "@/lib/data/orders";
import { ALL_STATUSES, BOARD_STATUSES, COMPLETED_STATUSES, lateCutoff } from "@/lib/workflow";
import { getRange } from "@/lib/time";
import type { OrderStatus, OrderWithRelations, TechnicianKpi } from "@/lib/types";
import type { OrderFilters } from "@/components/admin/orders-url";

export const PAGE_SIZE = 25;
export const BOARD_COLUMN_LIMIT = 20;

type Supabase = Awaited<ReturnType<typeof createClient>>;

// ----------------------------------------------------------------- orders --

/**
 * Orders query with search / technician / branch / status filters applied. Search covers
 * order no, customer name and phone; digit-only queries also match phone numbers
 * regardless of formatting (0123456789 matches "012-345 6789").
 */
function ordersQuery(
  supabase: Supabase,
  select: string,
  f: Pick<OrderFilters, "q" | "tech" | "branch">,
  status: OrderStatus | "all",
  opts?: { count?: "exact"; head?: boolean },
) {
  let q = supabase.from("orders").select(select, opts);
  const term = f.q.replace(/[%,()*\\]/g, "").trim();
  if (term.length > 0) {
    const clauses = [`order_no.ilike.%${term}%`, `customer_name.ilike.%${term}%`, `customer_phone.ilike.%${term}%`];
    const digits = term.replace(/\D/g, "");
    if (digits.length >= 4 && digits.length === term.replace(/[\s-]/g, "").length) {
      clauses.push(`customer_phone.ilike.%${digits.split("").join("%")}%`);
    }
    q = q.or(clauses.join(","));
  }
  if (f.tech === "none") q = q.is("assigned_technician_id", null);
  else if (f.tech) q = q.eq("assigned_technician_id", f.tech);
  if (f.branch) q = q.eq("branch_id", f.branch);
  if (status !== "all") q = q.eq("status", status);
  return q;
}

export async function getOrderList(f: OrderFilters) {
  const supabase = await createClient();
  const from = (f.page - 1) * PAGE_SIZE;

  const [listRes, counts] = await Promise.all([
    ordersQuery(supabase, ORDER_SELECT, f, f.status, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    getStatusTabCounts(supabase, f),
  ]);

  return {
    orders: ((listRes.data ?? []) as unknown as OrderWithRelations[]).map(normalizeOrder),
    total: listRes.count ?? 0,
    counts,
    error: listRes.error?.message ?? null,
  };
}

export async function getOrderBoard(f: OrderFilters) {
  const supabase = await createClient();
  const [columns, counts] = await Promise.all([
    Promise.all(
      BOARD_STATUSES.map(async (status) => {
        const { data } = await ordersQuery(supabase, ORDER_SELECT, f, status)
          .order("updated_at", { ascending: false })
          .limit(BOARD_COLUMN_LIMIT);
        return [status, ((data ?? []) as unknown as OrderWithRelations[]).map(normalizeOrder)] as const;
      }),
    ),
    getStatusTabCounts(supabase, f),
  ]);
  return { columns: Object.fromEntries(columns) as Record<OrderStatus, OrderWithRelations[]>, counts };
}

async function getStatusTabCounts(supabase: Supabase, f: OrderFilters) {
  const keys: (OrderStatus | "all")[] = ["all", ...ALL_STATUSES];
  const results = await Promise.all(
    keys.map(async (k) => {
      const { count } = await ordersQuery(supabase, "id", f, k, { count: "exact", head: true });
      return [k, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(results) as Record<OrderStatus | "all", number>;
}

// --------------------------------------------------------------- overview --

export interface ActivityItem {
  id: number;
  orderId: string;
  orderNo: string | null;
  customerName: string | null;
  action: string;
  actorName: string | null;
  actorRole: string | null;
  toStatus: OrderStatus | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export async function getOverview() {
  const supabase = await createClient();
  const today = getRange("today");
  const cutoff = lateCutoff();

  // One parallel batch: every panel on the overview comes from here.
  const [daily, todayJobs, late, unscheduled, awaitingReview, inProgressCount, statusCounts, activity, onSite] = await Promise.all([
    supabase.rpc("kpi_daily", { p_from: today.from, p_to: today.to }),
    supabase
      .from("orders")
      .select(ORDER_SELECT)
      .gte("scheduled_at", today.from)
      .lt("scheduled_at", today.to)
      .neq("status", "cancelled")
      .order("scheduled_at", { ascending: true })
      .limit(60),
    // Running late: slot passed, technician hasn't started.
    supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" })
      .eq("status", "assigned")
      .lt("scheduled_at", cutoff)
      .order("scheduled_at", { ascending: true })
      .limit(8),
    // Assigned but no visit time agreed yet.
    supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" })
      .eq("status", "assigned")
      .is("scheduled_at", null)
      .order("created_at", { ascending: true })
      .limit(8),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "job_done"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.rpc("kpi_status_counts"),
    supabase
      .from("order_events")
      .select("id, order_id, action, actor_name, actor_role, to_status, payload, created_at, order:orders(order_no, customer_name)")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("orders").select("assigned_technician_id").eq("status", "in_progress"),
  ]);

  const day = ((daily.data ?? []) as { jobs_created: number; jobs_completed: number; revenue: number }[])[0];
  const counts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const row of (statusCounts.data ?? []) as { status: OrderStatus; total: number }[]) {
    counts[row.status] = Number(row.total);
  }
  const todayList = ((todayJobs.data ?? []) as unknown as OrderWithRelations[]).map(normalizeOrder);
  const doneToday = todayList.filter((o) => (COMPLETED_STATUSES as string[]).includes(o.status)).length;

  return {
    stats: {
      todayTotal: todayList.length,
      todayDone: doneToday,
      onSite: inProgressCount.count ?? 0,
      late: late.count ?? 0,
      awaitingReview: awaitingReview.count ?? 0,
      revenueToday: Number(day?.revenue ?? 0),
      completedToday: Number(day?.jobs_completed ?? 0),
    },
    statusCounts: counts,
    generatedAt: new Date().toISOString(),
    today: todayList,
    late: ((late.data ?? []) as unknown as OrderWithRelations[]).map(normalizeOrder),
    lateTotal: late.count ?? 0,
    unscheduled: ((unscheduled.data ?? []) as unknown as OrderWithRelations[]).map(normalizeOrder),
    unscheduledTotal: unscheduled.count ?? 0,
    activity: ((activity.data ?? []) as Record<string, unknown>[]).map((e): ActivityItem => {
      const order = (Array.isArray(e.order) ? e.order[0] : e.order) as { order_no: string; customer_name: string } | null;
      return {
        id: e.id as number,
        orderId: e.order_id as string,
        orderNo: order?.order_no ?? null,
        customerName: order?.customer_name ?? null,
        action: e.action as string,
        actorName: (e.actor_name as string | null) ?? null,
        actorRole: (e.actor_role as string | null) ?? null,
        toStatus: (e.to_status as OrderStatus | null) ?? null,
        payload: (e.payload as Record<string, unknown>) ?? {},
        createdAt: e.created_at as string,
      };
    }),
    onSiteTechIds: [
      ...new Set(
        ((onSite.data ?? []) as { assigned_technician_id: string | null }[])
          .map((o) => o.assigned_technician_id)
          .filter((id): id is string => !!id),
      ),
    ],
  };
}

// ------------------------------------------------------------ technicians --

export async function getTechnicianWeekKpis() {
  const supabase = await createClient();
  const week = getRange("this_week");
  const { data } = await supabase.rpc("kpi_technician_summary", { p_from: week.from, p_to: week.to });
  const map = new Map<string, TechnicianKpi>();
  for (const r of (data ?? []) as TechnicianKpi[]) {
    map.set(r.technician_id, {
      ...r,
      jobs_completed: Number(r.jobs_completed),
      total_amount: Number(r.total_amount),
      extra_charges: Number(r.extra_charges),
      avg_ticket: Number(r.avg_ticket),
      reschedules: Number(r.reschedules),
      open_jobs: Number(r.open_jobs),
      avg_hours_to_complete: r.avg_hours_to_complete === null ? null : Number(r.avg_hours_to_complete),
      avg_rating: r.avg_rating === null ? null : Number(r.avg_rating),
    });
  }
  return map;
}

export interface RosterTechnician {
  id: string;
  name: string;
  phone: string;
  team_code: string;
  skills: string[];
  active: boolean;
  branch: { id: number; code: string; name: string; state: string } | null;
}

export async function getRoster() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technicians")
    .select("id, name, phone, team_code, skills, active, branch:branches(id, code, name, state)")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((t) => ({
    ...(t as unknown as RosterTechnician),
    branch: (Array.isArray(t.branch) ? t.branch[0] : t.branch) ?? null,
  })) as RosterTechnician[];
}
