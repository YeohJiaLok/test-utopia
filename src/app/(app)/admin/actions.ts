"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ORDER_SELECT } from "@/lib/data/orders";
import { workflowErrorMessage } from "@/lib/workflow";
import type { OrderStatus } from "@/lib/types";
import {
  cancelOrderSchema,
  formatMyMobile,
  orderFormSchema,
  rescheduleSchema,
  type CancelOrderValues,
  type OrderFormValues,
  type RescheduleValues,
} from "@/components/admin/order-schema";
import { fromMytInputValue } from "@/components/admin/datetime";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export interface CreatedOrderSummary {
  id: string;
  orderNo: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  problemDescription: string;
  serviceName: string;
  quotedPrice: number;
  technicianName: string | null;
  technicianTeam: string | null;
  branchName: string | null;
  scheduledAt: string | null;
  adminNotes: string | null;
  source: string;
  createdAt: string;
  notification: { id: string; deepLink: string } | null;
}

function revalidateOrderViews(orderId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/technicians");
  revalidatePath("/admin/notifications");
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
}

function flattenIssues(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    out[key] ??= i.message;
  }
  return out;
}

/**
 * The order number the next saved order will get (read without consuming the sequence).
 * Null if it can't be read; the form then shows the format only.
 */
export async function peekNextOrderNo(): Promise<string | null> {
  await requireUser(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("peek_next_order_no");
  return error || typeof data !== "string" ? null : data;
}

/** Module 1: create an order via the `create_order` workflow function. */
export async function createOrderAction(
  values: OrderFormValues,
  meta: { source: "manual" | "ai_document" },
): Promise<ActionResult<CreatedOrderSummary>> {
  await requireUser(["admin"]);

  const parsed = orderFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors: flattenIssues(parsed.error.issues) };
  }
  const v = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_order", {
    p_customer_name: v.customerName,
    p_customer_phone: formatMyMobile(v.customerPhone),
    p_customer_address: v.customerAddress,
    p_service_type_id: Number(v.serviceTypeId),
    p_problem_description: v.problemDescription,
    p_quoted_price: Number(v.quotedPrice),
    p_assigned_technician_id: v.technicianId || null,
    p_admin_notes: v.adminNotes || null,
    p_scheduled_at: fromMytInputValue(v.scheduledAt),
    p_source: meta.source === "ai_document" ? "ai_document" : "manual",
  });
  if (error) return { ok: false, error: workflowErrorMessage(error) };

  const created = (Array.isArray(data) ? data[0] : data) as { id: string } | null;
  if (!created?.id) return { ok: false, error: "The order was not created. Please try again." };

  const [{ data: order }, { data: notification }] = await Promise.all([
    supabase.from("orders").select(ORDER_SELECT).eq("id", created.id).single(),
    supabase
      .from("notifications")
      .select("id, deep_link")
      .eq("order_id", created.id)
      .eq("template", "job_assigned_technician")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  revalidateOrderViews();

  const o = order ?? created;
  return {
    ok: true,
    data: {
      id: o.id,
      orderNo: o.order_no,
      status: o.status,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      customerAddress: o.customer_address,
      problemDescription: o.problem_description,
      serviceName: o.service_type?.name ?? "",
      quotedPrice: Number(o.quoted_price),
      technicianName: o.technician?.name ?? null,
      technicianTeam: o.technician?.team_code ?? null,
      branchName: o.branch?.name ?? null,
      scheduledAt: o.scheduled_at,
      adminNotes: o.admin_notes,
      source: o.source,
      createdAt: o.created_at,
      notification: notification?.deep_link ? { id: notification.id, deepLink: notification.deep_link } : null,
    },
  };
}

/** Assign or reassign a technician (admin only; DB enforces new/assigned status). */
export async function assignTechnicianAction(orderId: string, technicianId: string): Promise<ActionResult<{ technicianName: string }>> {
  await requireUser(["admin"]);
  if (!orderId || !technicianId) return { ok: false, error: "Choose a technician" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_technician", { p_order_id: orderId, p_technician_id: technicianId });
  if (error) return { ok: false, error: workflowErrorMessage(error) };

  const { data: tech } = await supabase.from("technicians").select("name").eq("id", technicianId).maybeSingle();
  revalidateOrderViews(orderId);
  return { ok: true, data: { technicianName: tech?.name ?? "technician" } };
}

/** Postpone / reschedule an open order with a mandatory reason. */
export async function rescheduleOrderAction(orderId: string, values: RescheduleValues): Promise<ActionResult> {
  await requireUser(["admin"]);
  const parsed = rescheduleSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors: flattenIssues(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_order", {
    p_order_id: orderId,
    p_new_scheduled_at: fromMytInputValue(parsed.data.scheduledAt),
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: workflowErrorMessage(error) };

  revalidateOrderViews(orderId);
  return { ok: true };
}

/** Close a reviewed order (admin or manager, enforced again by `close_job`). */
/**
 * Cancels an order before the work is done, with a reason. The database checks role and
 * status, records it in the audit chain and notifies the technician and customer.
 */
export async function cancelOrderAction(orderId: string, values: CancelOrderValues): Promise<ActionResult> {
  await requireUser(["admin"]);
  const parsed = cancelOrderSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields", fieldErrors: flattenIssues(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note || null,
  });
  if (error) return { ok: false, error: workflowErrorMessage(error) };

  revalidateOrderViews(orderId);
  revalidatePath("/manager");
  revalidatePath("/tech");
  return { ok: true };
}

export async function closeJobAction(orderId: string): Promise<ActionResult> {
  await requireUser(["admin", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_job", { p_order_id: orderId });
  if (error) return { ok: false, error: workflowErrorMessage(error) };

  revalidateOrderViews(orderId);
  revalidatePath("/manager");
  return { ok: true };
}
