import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { toCsv } from "@/app/(app)/audit/_lib/csv";
import { exportDecisionHistory, parseHistoryFilters } from "../_lib/workspace";

const LABEL = { approved: "Approved", rework: "Sent back", closed: "Closed" } as const;

/**
 * GET /manager/reviews/export?<same params as the Decision history tab> → CSV (newest first,
 * up to 5,000 rows). Reads with the user-scoped client, so RLS applies exactly as on the page.
 */
export async function GET(request: Request) {
  const user = await requireUser(["manager", "admin"]);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const rows = await exportDecisionHistory(parseHistoryFilters(params), user.id);

  const body =
    "﻿" +
    toCsv(
      ["decided_at_myt", "decided_at_utc", "decision", "order_no", "customer", "technician", "final_amount_myr", "rating", "notes", "decided_by", "decided_by_role", "current_status"],
      rows.map((r) => [formatDateTime(r.at), r.at, LABEL[r.kind], r.orderNo, r.customer, r.technician, r.final ?? "", r.rating ?? "", r.notes ?? "", r.by, r.byRole ?? "", r.status]),
    );
  const stamp = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sejuk-review-decisions-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
