import type { AiRun, AppRole, OrderEvent } from "@/lib/types";
import type { AuditFilters, ResolvedRange } from "./filters";

export interface AuditEventRow extends OrderEvent {
  order_no: string | null;
  customer_name: string | null;
}

export interface AuditRunRow extends AiRun {
  user_name: string | null;
  user_role: AppRole | null;
}

export type UserAdminAction =
  | "user_created"
  | "user_updated"
  | "role_changed"
  | "user_deactivated"
  | "user_reactivated"
  | "password_reset";

export interface UserAdminEventRow {
  id: number;
  actor_id: string | null;
  actor_name: string;
  actor_role: AppRole | null;
  action: UserAdminAction;
  target_id: string | null;
  target_name: string;
  target_email: string | null;
  changes: Record<string, { from: unknown; to: unknown }>;
  created_at: string;
}

export type KpiFormat = "number" | "seconds" | "compact" | "percent";

export interface AuditKpi {
  key: string;
  label: string;
  value: number | null;
  format: KpiFormat;
  hint?: string;
  tone?: "default" | "warning";
}

export interface VolumeBucket {
  key: string; // YYYY-MM-DD (MYT) of the bucket start
  label: string;
  count: number;
}

interface AuditPageBase {
  filters: AuditFilters;
  range: ResolvedRange;
  total: number;
  page: number;
  pages: number;
  kpis: AuditKpi[];
  volume: { buckets: VolumeBucket[]; unit: "hour" | "day" | "week" };
  /** KPI aggregation hit its row cap; figures cover the most recent rows only. */
  capped: boolean;
}

export type AuditPageData =
  | (AuditPageBase & { tab: "events"; rows: AuditEventRow[] })
  | (AuditPageBase & { tab: "ai"; rows: AuditRunRow[] })
  | (AuditPageBase & { tab: "users"; rows: UserAdminEventRow[] });
