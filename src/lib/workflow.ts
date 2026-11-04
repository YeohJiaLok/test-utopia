import type { AppRole, OrderStatus } from "@/lib/types";

/**
 * Client-side mirror of the state machine enforced by the database
 * (supabase/migrations/*_workflow.sql). The DB is the source of truth; this
 * drives which actions the UI offers.
 */
/** The main lifecycle, in order (the status pipeline). Cancelled sits beside it. */
export const ORDER_STATUSES: OrderStatus[] = ["new", "assigned", "in_progress", "job_done", "reviewed", "closed"];
/**
 * Every status, for filters and counts. Rework (sent back by the manager) is a loop between
 * Job Done and In Progress; Cancelled is a terminal side status.
 */
export const ALL_STATUSES: OrderStatus[] = ["new", "assigned", "in_progress", "rework", "job_done", "reviewed", "closed", "cancelled"];

export const STATUS_META: Record<
  OrderStatus,
  { label: string; short: string; description: string; tone: StatusTone }
> = {
  new: { label: "New", short: "New", description: "Created, awaiting technician assignment", tone: "slate" },
  assigned: { label: "Assigned", short: "Assigned", description: "Technician assigned, not started", tone: "blue" },
  in_progress: { label: "In Progress", short: "On site", description: "Technician is working on site", tone: "amber" },
  rework: { label: "Rework", short: "Rework", description: "Sent back by the manager, technician to fix and resubmit", tone: "orange" },
  job_done: { label: "Job Done", short: "Done", description: "Completed, awaiting manager review", tone: "violet" },
  reviewed: { label: "Reviewed", short: "Reviewed", description: "Approved by manager", tone: "teal" },
  closed: { label: "Closed", short: "Closed", description: "Finalised and archived", tone: "green" },
  cancelled: { label: "Cancelled", short: "Cancelled", description: "Cancelled before the work was done", tone: "red" },
};

export type StatusTone = "slate" | "blue" | "amber" | "orange" | "violet" | "teal" | "green" | "red";

export type WorkflowAction =
  | "assign"
  | "reassign"
  | "start"
  | "complete"
  | "review"
  | "rework"
  | "close"
  | "reschedule"
  | "cancel";

interface TransitionRule {
  action: WorkflowAction;
  from: OrderStatus[];
  to: OrderStatus | null; // null = status unchanged
  roles: AppRole[];
  /** Must the actor be the technician assigned to the order? */
  ownerOnly?: boolean;
}

export const TRANSITIONS: TransitionRule[] = [
  { action: "assign", from: ["new"], to: "assigned", roles: ["admin"] },
  { action: "reassign", from: ["assigned"], to: "assigned", roles: ["admin"] },
  { action: "start", from: ["assigned"], to: "in_progress", roles: ["technician"], ownerOnly: true },
  // Assigned → In Progress → Job Done: the job must be started on site first (complete_job enforces it).
  // Rework → Job Done is the technician resubmitting a job the manager sent back.
  { action: "complete", from: ["in_progress", "rework"], to: "job_done", roles: ["technician"], ownerOnly: true },
  { action: "review", from: ["job_done"], to: "reviewed", roles: ["manager"] },
  { action: "rework", from: ["job_done"], to: "rework", roles: ["manager"] },
  { action: "close", from: ["reviewed"], to: "closed", roles: ["manager", "admin"] },
  { action: "reschedule", from: ["new", "assigned", "in_progress"], to: null, roles: ["admin", "technician"], ownerOnly: true },
  { action: "cancel", from: ["new", "assigned", "in_progress"], to: "cancelled", roles: ["admin"] },
];

export function canPerform(
  action: WorkflowAction,
  ctx: { status: OrderStatus; role: AppRole; isAssignedTechnician: boolean },
): boolean {
  const rule = TRANSITIONS.find((t) => t.action === action);
  if (!rule) return false;
  if (!rule.from.includes(ctx.status)) return false;
  if (!rule.roles.includes(ctx.role)) return false;
  if (rule.ownerOnly && ctx.role === "technician" && !ctx.isAssignedTechnician) return false;
  return true;
}

export function availableActions(ctx: { status: OrderStatus; role: AppRole; isAssignedTechnician: boolean }) {
  return TRANSITIONS.filter((t) => canPerform(t.action, ctx)).map((t) => t.action);
}

/** Position on the pipeline. Rework sits at the In Progress step (the work is being redone). */
export function statusIndex(status: OrderStatus) {
  return ORDER_STATUSES.indexOf(status === "rework" ? "in_progress" : status);
}

/** A job counts as running late this long after its slot if nobody has started it. */
export const LATE_GRACE_MINUTES = 15;
export function lateCutoff(now: Date = new Date()) {
  return new Date(now.getTime() - LATE_GRACE_MINUTES * 60_000).toISOString();
}

export const OPEN_STATUSES: OrderStatus[] = ["new", "assigned", "in_progress", "rework"];
/** Board columns: the pipeline plus Rework beside In Progress. */
export const BOARD_STATUSES: OrderStatus[] = ["new", "assigned", "in_progress", "rework", "job_done", "reviewed", "closed"];
/** Work a technician is holding right now (their active list, workload counts). */
export const TECH_ACTIVE_STATUSES: OrderStatus[] = ["assigned", "in_progress", "rework"];
export const COMPLETED_STATUSES: OrderStatus[] = ["job_done", "reviewed", "closed"];

export const EVENT_LABELS: Record<string, string> = {
  order_created: "Order created",
  technician_assigned: "Technician assigned",
  technician_reassigned: "Technician reassigned",
  job_started: "Job started on site",
  job_completed: "Job completed",
  job_reviewed: "Reviewed & approved",
  rework_requested: "Sent back for rework",
  job_resubmitted: "Resubmitted after rework",
  status_migrated: "Status corrected by system",
  job_closed: "Order closed",
  job_rescheduled: "Rescheduled",
  order_cancelled: "Order cancelled",
};

/** Mirrors public.cancel_reason_label() in the database. */
export const CANCEL_REASONS = [
  { value: "customer_request", label: "Customer cancelled" },
  { value: "duplicate", label: "Duplicate order" },
  { value: "unreachable", label: "Customer unreachable" },
  { value: "out_of_area", label: "Outside service area" },
  { value: "other", label: "Other" },
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number]["value"];
export const CANCEL_REASON_LABELS: Record<string, string> = Object.fromEntries(CANCEL_REASONS.map((r) => [r.value, r.label]));

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  ewallet: "E-wallet (TNG / GrabPay)",
  unpaid: "Not collected",
};

/** Maps Postgres error codes raised by workflow functions to user-facing copy. */
export function workflowErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Something went wrong";
  if (error.code === "42501") return error.message ?? "You are not allowed to perform this action";
  if (error.code === "P0001" || error.code === "22023" || error.code === "P0002") return error.message ?? "Invalid request";
  return error.message ?? "Something went wrong";
}
