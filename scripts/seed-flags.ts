import { evaluateRules } from "../src/lib/ai/rules";
import type { SeedOutput } from "./seed-data";

const RECENT_MS = 14 * 86_400_000;

/**
 * Runs the AI Supervisor's deterministic rule engine over recently completed seed jobs.
 * Jobs still awaiting review get open flags; already-reviewed jobs get resolved ones,
 * so the inbox and the history both have realistic content.
 */
export function buildSeedFlags(data: SeedOutput, now: Date = new Date()): Record<string, unknown>[] {
  const completions = new Map(data.completions.map((c) => [c.order_id, c]));
  const attachments = new Map<unknown, { kind: "photo" }[]>();
  for (const a of data.attachments) {
    const list = attachments.get(a.order_id) ?? [];
    list.push({ kind: "photo" });
    attachments.set(a.order_id, list);
  }

  const rows: Record<string, unknown>[] = [];
  for (const order of data.orders) {
    const status = order.status as string;
    if (!["job_done", "reviewed", "closed"].includes(status)) continue;
    const completion = completions.get(order.id);
    if (!completion) continue;
    const completedAt = new Date(completion.completed_at as string);
    if (now.getTime() - completedAt.getTime() > RECENT_MS) continue;

    const flags = evaluateRules({
      order: {
        quoted_price: order.quoted_price as number,
        reschedule_count: order.reschedule_count as number,
        started_at: order.started_at as string | null,
        completed_at: order.completed_at as string | null,
      },
      completion: {
        quoted_price: completion.quoted_price as number,
        extra_charges: completion.extra_charges as number,
        final_amount: Number(completion.quoted_price) + Number(completion.extra_charges),
        remarks: completion.remarks as string | null,
        payment_amount: completion.payment_amount as number | null,
        payment_method: completion.payment_method as never,
        completed_at: completion.completed_at as string,
      },
      attachments: attachments.get(order.id) ?? [],
    });

    const open = status === "job_done";
    for (const f of flags) {
      rows.push({
        order_id: order.id,
        source: "rule",
        ...f,
        resolved: !open,
        resolved_at: open ? null : order.reviewed_at,
        resolution_note: open ? null : "Checked during manager review",
        created_at: completedAt.toISOString(),
      });
    }
  }
  return rows;
}
