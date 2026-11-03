import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  AiFlag,
  JobCompletion,
  Notification,
  OrderAttachment,
  OrderEvent,
  OrderWithRelations,
  Reschedule,
  Review,
} from "@/lib/types";

/** PostgREST select for an order with the relations shown in lists and headers. */
export const ORDER_SELECT =
  "*, service_type:service_types(id, code, name), technician:technicians(id, name, phone, team_code), branch:branches(id, code, name)";

export function normalizeOrder<T extends { quoted_price: unknown }>(o: T): T & { quoted_price: number } {
  return { ...o, quoted_price: Number(o.quoted_price) };
}

export type AttachmentWithUrl = OrderAttachment & { url: string | null };

export interface OrderDetail {
  order: OrderWithRelations;
  completion: JobCompletion | null;
  attachments: AttachmentWithUrl[];
  receiptUrl: string | null;
  events: OrderEvent[];
  reschedules: Reschedule[];
  review: Review | null;
  flags: AiFlag[];
  notifications: Notification[];
}

const SIGNED_URL_TTL = 60 * 30;

/** Everything needed to render an order detail page. RLS decides what the caller may see. */
export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();

  const { data: order } = await supabase.from("orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle();
  if (!order) return null;

  const [completion, attachments, events, reschedules, review, flags, notifications] = await Promise.all([
    supabase.from("job_completions").select("*").eq("order_id", orderId).maybeSingle(),
    supabase.from("order_attachments").select("*").eq("order_id", orderId).order("created_at"),
    supabase.from("order_events").select("*").eq("order_id", orderId).order("created_at"),
    supabase.from("reschedules").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    supabase.from("reviews").select("*").eq("order_id", orderId).maybeSingle(),
    supabase.from("ai_flags").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    supabase.from("notifications").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
  ]);

  const files = (attachments.data ?? []) as OrderAttachment[];
  const paths = files.map((f) => f.storage_path);
  const receiptPath = (completion.data as JobCompletion | null)?.receipt_path ?? null;
  if (receiptPath) paths.push(receiptPath);

  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("job-media").createSignedUrls(paths, SIGNED_URL_TTL);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }

  const c = completion.data as JobCompletion | null;

  return {
    order: normalizeOrder(order) as OrderWithRelations,
    completion: c
      ? {
          ...c,
          quoted_price: Number(c.quoted_price),
          extra_charges: Number(c.extra_charges),
          final_amount: Number(c.final_amount),
          payment_amount: c.payment_amount === null ? null : Number(c.payment_amount),
        }
      : null,
    attachments: files.map((f) => ({ ...f, url: signed.get(f.storage_path) ?? null })),
    receiptUrl: receiptPath ? (signed.get(receiptPath) ?? null) : null,
    events: (events.data ?? []) as OrderEvent[],
    reschedules: (reschedules.data ?? []) as Reschedule[],
    review: (review.data as Review | null) ?? null,
    flags: (flags.data ?? []) as AiFlag[],
    notifications: (notifications.data ?? []) as Notification[],
  };
}
