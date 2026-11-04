// Domain types mirroring supabase/migrations. Kept hand-written so the contract is
// readable in one place; regenerate with `supabase gen types` for exhaustive typing.

export type AppRole = "admin" | "technician" | "manager";
export type OrderStatus = "new" | "assigned" | "in_progress" | "job_done" | "reviewed" | "closed" | "cancelled";
export type AttachmentKind = "photo" | "video" | "pdf" | "receipt";
export type PaymentMethod = "cash" | "card" | "bank_transfer" | "ewallet" | "unpaid";
export type FlagSeverity = "low" | "medium" | "high";
export type NotificationChannel = "whatsapp" | "in_app";
export type NotificationAudience = "customer" | "technician" | "manager" | "accounts";
export type AiRunKind = "copilot" | "supervisor" | "extraction" | "insight";

export interface Branch {
  id: number;
  code: string;
  name: string;
  state: string;
}

export interface ServiceType {
  id: number;
  code: string;
  name: string;
  base_price: number;
  est_minutes: number;
  active: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  role: AppRole;
  branch_id: number | null;
  phone: string | null;
  active: boolean;
}

export interface Technician {
  id: string;
  profile_id: string | null;
  name: string;
  phone: string;
  branch_id: number;
  team_code: string;
  skills: string[];
  active: boolean;
}

export interface Order {
  id: string;
  order_no: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  branch_id: number | null;
  service_type_id: number;
  problem_description: string;
  quoted_price: number;
  assigned_technician_id: string | null;
  admin_notes: string | null;
  status: OrderStatus;
  scheduled_at: string | null;
  reschedule_count: number;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  /** Code from public.cancel_reason_label(): customer_request, duplicate, unreachable, out_of_area, other. */
  cancel_reason: string | null;
  cancel_note: string | null;
}

/** Order joined with the most commonly displayed relations. */
export interface OrderWithRelations extends Order {
  service_type: Pick<ServiceType, "id" | "code" | "name"> | null;
  technician: Pick<Technician, "id" | "name" | "phone" | "team_code"> | null;
  branch: Pick<Branch, "id" | "code" | "name"> | null;
}

export interface JobCompletion {
  order_id: string;
  technician_id: string;
  work_done: string;
  quoted_price: number;
  extra_charges: number;
  final_amount: number;
  remarks: string | null;
  payment_amount: number | null;
  payment_method: PaymentMethod | null;
  receipt_path: string | null;
  completed_at: string;
}

export interface OrderAttachment {
  id: string;
  order_id: string;
  kind: AttachmentKind;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface OrderEvent {
  id: number;
  order_id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: AppRole | null;
  action: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Reschedule {
  id: string;
  order_id: string;
  technician_id: string | null;
  old_scheduled_at: string | null;
  new_scheduled_at: string;
  reason: string;
  requested_by: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  order_id: string;
  manager_id: string | null;
  rating: number | null;
  decision: "approved" | "rework";
  notes: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  order_id: string | null;
  channel: NotificationChannel;
  audience: NotificationAudience;
  recipient_profile_id: string | null;
  recipient_phone: string | null;
  template: string;
  title: string;
  message: string;
  deep_link: string | null;
  status: "pending" | "opened" | "sent" | "read";
  created_at: string;
  read_at: string | null;
}

export interface AiFlag {
  id: string;
  order_id: string;
  rule_code: string;
  severity: FlagSeverity;
  source: "rule" | "ai";
  title: string;
  explanation: string;
  recommended_action: string | null;
  evidence: Record<string, unknown>;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

export interface AiToolCall {
  name: string;
  input: unknown;
  ok: boolean;
  rows?: number;
  ms?: number;
  error?: string;
}

export interface AiRun {
  id: string;
  kind: AiRunKind;
  user_id: string | null;
  input: string | null;
  tool_calls: AiToolCall[];
  output: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  status: "ok" | "error" | "refused" | "blocked";
  error: string | null;
  created_at: string;
}

export interface TechnicianKpi {
  technician_id: string;
  technician_name: string;
  branch_name: string;
  team_code: string;
  jobs_completed: number;
  total_amount: number;
  extra_charges: number;
  avg_ticket: number;
  reschedules: number;
  open_jobs: number;
  avg_hours_to_complete: number | null;
  avg_rating: number | null;
}

export interface DailyKpi {
  day: string;
  jobs_created: number;
  jobs_completed: number;
  revenue: number;
}

export interface WorkloadStat {
  technician_id: string;
  technician_name: string;
  branch_name: string;
  jobs_completed: number;
  open_jobs: number;
  reschedules: number;
  team_mean: number;
  team_stddev: number;
  z_score: number;
}

/** Signed-in user as resolved by the data access layer. */
export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
  branchId: number | null;
  technicianId: string | null;
}
