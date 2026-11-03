"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { orderHref } from "@/lib/routes";
import type { OrderStatus } from "@/lib/types";

export interface OrderSearchHit {
  id: string;
  orderNo: string;
  customer: string;
  status: OrderStatus;
  href: string;
}

/** Command palette search. RLS scopes results to what the caller may see. */
export async function searchOrders(query: string): Promise<OrderSearchHit[]> {
  const user = await requireUser();
  const q = query.trim().replace(/[%,()]/g, "");
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_no, customer_name, status")
    .or(`order_no.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(8);
  return (data ?? []).map((o) => ({
    id: o.id,
    orderNo: o.order_no,
    customer: o.customer_name,
    status: o.status as OrderStatus,
    href: orderHref(user.role, o.id),
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
