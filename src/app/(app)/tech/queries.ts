import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ORDER_SELECT, normalizeOrder } from "@/lib/data/orders";
import { getRange } from "@/lib/time";
import { COMPLETED_STATUSES } from "@/lib/workflow";
import type { JobCompletion, OrderWithRelations } from "@/lib/types";

export type CompletionSummary = Pick<
  JobCompletion,
  "final_amount" | "extra_charges" | "payment_amount" | "payment_method" | "completed_at"
>;

export type TechJob = OrderWithRelations & { completion: CompletionSummary | null };

const JOB_SELECT = `${ORDER_SELECT}, completion:job_completions(final_amount, extra_charges, payment_amount, payment_method, completed_at)`;

/** PostgREST returns a one-to-one embed as an object, but be defensive about arrays. */
function toJob(row: Record<string, unknown>): TechJob {
  const raw = row.completion as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  const c = Array.isArray(raw) ? raw[0] : raw;
  const order = normalizeOrder(row as unknown as OrderWithRelations);
  return {
    ...order,
    completion: c
      ? {
          final_amount: Number(c.final_amount),
          extra_charges: Number(c.extra_charges),
          payment_amount: c.payment_amount === null || c.payment_amount === undefined ? null : Number(c.payment_amount),
          payment_method: (c.payment_method as CompletionSummary["payment_method"]) ?? null,
          completed_at: String(c.completed_at),
        }
      : null,
  };
}

export function collectedAmount(job: TechJob) {
  const c = job.completion;
  if (!c || c.payment_method === null || c.payment_method === "unpaid") return 0;
  return c.payment_amount ?? 0;
}

/** Jobs board for the signed-in technician. RLS already scopes rows to their assignments. */
export async function getMyJobs(technicianId: string | null) {
  const supabase = await createClient();
  const today = getRange("today");

  let open = supabase
    .from("orders")
    .select(JOB_SELECT)
    .in("status", ["assigned", "in_progress"])
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  let done = supabase
    .from("orders")
    .select(JOB_SELECT)
    .in("status", COMPLETED_STATUSES)
    .gte("completed_at", today.from)
    .lt("completed_at", today.to)
    .order("completed_at", { ascending: false });
  if (technicianId) {
    open = open.eq("assigned_technician_id", technicianId);
    done = done.eq("assigned_technician_id", technicianId);
  }

  const [openRes, doneRes] = await Promise.all([open, done]);
  const openJobs = (openRes.data ?? []).map((r) => toJob(r as Record<string, unknown>));
  const doneToday = (doneRes.data ?? []).map((r) => toJob(r as Record<string, unknown>));

  // Active = on site now, or due today / overdue / unscheduled. Upcoming = assigned for a later day.
  const active: TechJob[] = [];
  const upcoming: TechJob[] = [];
  const endOfToday = new Date(today.to).getTime();
  for (const j of openJobs) {
    if (j.status === "in_progress" || !j.scheduled_at || new Date(j.scheduled_at).getTime() < endOfToday) active.push(j);
    else upcoming.push(j);
  }
  // In-progress jobs float to the top, then by schedule.
  active.sort((a, b) => {
    if (a.status !== b.status) return a.status === "in_progress" ? -1 : 1;
    return (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "");
  });

  return {
    active,
    upcoming,
    doneToday,
    collectedToday: doneToday.reduce((sum, j) => sum + collectedAmount(j), 0),
  };
}

/** Completed jobs (job_done / reviewed / closed) for the history screen. */
export async function getMyHistory(technicianId: string | null, days = 60) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let q = supabase
    .from("orders")
    .select(JOB_SELECT)
    .in("status", COMPLETED_STATUSES)
    .gte("completed_at", since)
    .order("completed_at", { ascending: false })
    .limit(200);
  if (technicianId) q = q.eq("assigned_technician_id", technicianId);

  const { data } = await q;
  return (data ?? []).map((r) => toJob(r as Record<string, unknown>));
}
