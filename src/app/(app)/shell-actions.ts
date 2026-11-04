"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { orderHref } from "@/lib/routes";
import type { OrderStatus } from "@/lib/types";

export interface OrderSearchHit {
  id: string;
  orderNo: string;
  customer: string;
  phone: string;
  address: string;
  status: OrderStatus;
  scheduledAt: string | null;
  service: string | null;
  technician: string | null;
  branch: string | null;
  /** Which field matched best: "Order number", "Phone", "Customer", "Technician", … or "Similar" (typo match). */
  matchedOn: string;
  href: string;
}

/**
 * Command palette search: ranked, typo-tolerant search across order number, customer, phone
 * (any formatting), address, problem, technician, service, branch and status. The work is done
 * by the search_orders() SQL function, which runs with the caller's RLS — technicians only ever
 * find their own jobs.
 */
export async function searchOrders(query: string): Promise<OrderSearchHit[]> {
  const user = await requireUser();
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_orders", { p_query: q, p_limit: 12 });
  if (error) throw new Error("Search is unavailable right now.");
  return (data ?? []).map((o: Record<string, unknown>) => ({
    id: o.id as string,
    orderNo: o.order_no as string,
    customer: o.customer_name as string,
    phone: o.customer_phone as string,
    address: o.customer_address as string,
    status: o.status as OrderStatus,
    scheduledAt: (o.scheduled_at as string | null) ?? null,
    service: (o.service_name as string | null) ?? null,
    technician: (o.technician_name as string | null) ?? null,
    branch: (o.branch_name as string | null) ?? null,
    matchedOn: o.matched_on as string,
    href: orderHref(user.role, o.id as string),
  }));
}

export async function markNotificationsRead(ids: string[]) {
  const user = await requireUser();
  if (!ids.length) return;
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .in("id", ids)
    .eq("recipient_profile_id", user.id);
}

/** Marks every in-app notification of the signed-in user as read (notification centre). */
export async function markAllNotificationsRead() {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("recipient_profile_id", user.id)
    .eq("channel", "in_app")
    .neq("status", "read");
  revalidatePath("/", "layout");
}
