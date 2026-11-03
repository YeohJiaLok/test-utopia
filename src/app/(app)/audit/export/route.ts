import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { EXPORT_ROW_CAP, mytDayKey, parseAuditFilters } from "../_lib/filters";
import { actionLabel } from "../_lib/labels";
import { toCsv } from "../_lib/csv";
import { getAuditExport } from "../_lib/queries";

/**
 * GET /audit/export?<same params as /audit> → CSV of the current filtered view (no paging),
 * newest first, capped at EXPORT_ROW_CAP rows. Reads through the user-scoped client, so RLS
 * applies exactly as on the page.
 */
export async function GET(request: Request) {
  const user = await requireUser(["admin", "manager"]);
  const filters = parseAuditFilters(new URL(request.url).searchParams);
  const data = await getAuditExport(filters);

  let headers: string[];
  let rows: unknown[][];
  switch (data.tab) {
    case "events":
      headers = ["event_id", "created_at_utc", "created_at_myt", "order_no", "order_id", "customer", "action", "action_label", "actor_name", "actor_role", "from_status", "to_status", "payload"];
      rows = data.rows.map((e) => [
        e.id,
        e.created_at,
        formatDateTime(e.created_at),
        e.order_no,
        e.order_id,
        e.customer_name,
        e.action,
        actionLabel("events", e.action),
        e.actor_name ?? "System",
        e.actor_role ?? "system",
        e.from_status,
        e.to_status,
        e.payload,
      ]);
      break;
    case "ai":
      headers = ["run_id", "created_at_utc", "created_at_myt", "kind", "user_name", "user_role", "status", "model", "input_tokens", "output_tokens", "latency_ms", "tool_call_count", "tools", "input", "output", "error"];
      rows = data.rows.map((r) => [
        r.id,
        r.created_at,
        formatDateTime(r.created_at),
        r.kind,
        r.user_name ?? "System",
        r.user_role ?? "system",
        r.status,
        r.model,
        r.input_tokens,
        r.output_tokens,
        r.latency_ms,
        r.tool_calls.length,
        r.tool_calls.map((t) => `${t.name}${t.ok ? "" : " (failed)"}`).join("; "),
        r.input,
        r.output,
        r.error,
      ]);
      break;
    case "users":
      headers = ["event_id", "created_at_utc", "created_at_myt", "action", "action_label", "actor_name", "actor_role", "target_name", "target_email", "changes"];
      rows = data.rows.map((e) => [
        e.id,
        e.created_at,
        formatDateTime(e.created_at),
        e.action,
        actionLabel("users", e.action),
        e.actor_name,
        e.actor_role,
        e.target_name,
        e.target_email,
        e.changes,
      ]);
      break;
  }

  const stamp = mytDayKey(new Date());
  const filename = `sejuk-audit-${data.tab}-${stamp}.csv`;
  // BOM so Excel opens UTF-8 (names, em dashes) correctly.
  const body = "\uFEFF" + toCsv(headers, rows);

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Audit-Rows": String(data.rows.length),
      "X-Audit-Total": String(data.total),
      "X-Audit-Truncated": String(data.total > data.rows.length || data.rows.length >= EXPORT_ROW_CAP),
      "X-Audit-Exported-By": encodeURIComponent(user.email ?? user.id),
    },
  });
}
