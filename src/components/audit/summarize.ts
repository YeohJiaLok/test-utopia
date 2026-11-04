import { formatDateTime, formatMYR } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/workflow";

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function humanizeKey(key: string) {
  const s = key.replace(/_/g, " ").replace(/\bid\b/i, "ID");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Display value for a payload / change field, aware of money, dates and payment methods. */
export function formatField(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && /(amount|price|charges|total)/i.test(key)) return formatMYR(value);
  if (typeof value === "string") {
    if (key === "payment_method") return PAYMENT_METHOD_LABELS[value] ?? value;
    if (ISO_RE.test(value) && !Number.isNaN(Date.parse(value))) return `${formatDateTime(value)} MYT`;
    if (UUID_RE.test(value)) return value;
    return value;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** One-line description of what an order event carried, for rows without a status change. */
export function summarizePayload(action: string, payload: Record<string, unknown>): string | null {
  const p = payload ?? {};
  switch (action) {
    case "technician_assigned":
    case "technician_reassigned":
      return p.technician_name ? `Assigned to ${String(p.technician_name)}` : null;
    case "job_rescheduled": {
      const when = typeof p.to === "string" ? formatDateTime(p.to) : null;
      const reason = typeof p.reason === "string" ? p.reason : null;
      return [when && `To ${when}`, reason].filter(Boolean).join(" · ") || null;
    }
    case "order_cancelled":
      return [p.reason_label ? String(p.reason_label) : null, p.note ? `“${String(p.note)}”` : null].filter(Boolean).join(" · ") || null;
    case "job_completed": {
      const amount = p.final_amount ?? p.payment_amount;
      const method = typeof p.payment_method === "string" ? (PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method) : null;
      return [amount !== undefined && formatMYR(Number(amount)), method, p.attachments !== undefined && `${p.attachments} photos`]
        .filter(Boolean)
        .join(" · ") || null;
    }
    case "job_reviewed":
      return p.rating !== undefined ? `Rated ${p.rating}/5` : null;
    case "rework_requested":
      return typeof p.notes === "string" ? p.notes : null;
    case "order_created":
      return [p.quoted_price !== undefined && `Quoted ${formatMYR(Number(p.quoted_price))}`, p.source === "ai_document" && "from AI document"]
        .filter(Boolean)
        .join(" · ") || null;
    default:
      return null;
  }
}
