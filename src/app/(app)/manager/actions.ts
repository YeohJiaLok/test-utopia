"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { workflowErrorMessage } from "@/lib/workflow";

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const reviewSchema = z
  .object({
    orderId: z.uuid(),
    decision: z.enum(["approved", "rework"]),
    rating: z.number().int().min(1).max(5).nullable(),
    notes: z.string().trim().max(2000),
  })
  .superRefine((v, ctx) => {
    if (v.decision === "rework" && v.notes.length < 5) {
      ctx.addIssue({ code: "custom", path: ["notes"], message: "Explain what needs to be redone (at least 5 characters)." });
    }
    if (v.decision === "approved" && v.rating === null) {
      ctx.addIssue({ code: "custom", path: ["rating"], message: "Rate the job before approving." });
    }
  });

/** Oldest Job Done order other than `excludeId`, so the manager can keep reviewing. */
async function nextInQueue(excludeId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "job_done")
    .neq("id", excludeId)
    .order("completed_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function reviewOrder(input: z.input<typeof reviewSchema>): Promise<ActionResult<{ nextId: string | null }>> {
  await requireUser(["manager"]);
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid review" };
  const { orderId, decision, rating, notes } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_job", {
    p_order_id: orderId,
    p_decision: decision,
    p_rating: rating,
    p_notes: notes || null,
  });
  if (error) return { ok: false, error: workflowErrorMessage(error) };

  const nextId = await nextInQueue(orderId);
  revalidatePath("/", "layout");
  return { ok: true, nextId };
}

export async function closeOrder(orderId: string): Promise<ActionResult> {
  await requireUser(["manager", "admin"]);
  const id = z.uuid().safeParse(orderId);
  if (!id.success) return { ok: false, error: "Invalid order" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_job", { p_order_id: id.data });
  if (error) return { ok: false, error: workflowErrorMessage(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Closes several approved orders. Each one goes through close_job() (role + status checked
 * in the database, one audit-chain event per order); the result says which ones failed.
 */
export async function closeOrders(orderIds: string[]): Promise<ActionResult<{ closed: number; failed: { id: string; error: string }[] }>> {
  await requireUser(["manager", "admin"]);
  const ids = z.array(z.uuid()).min(1).max(100).safeParse(orderIds);
  if (!ids.success) return { ok: false, error: "Select between 1 and 100 orders." };

  const supabase = await createClient();
  const failed: { id: string; error: string }[] = [];
  let closed = 0;
  for (const id of ids.data) {
    const { error } = await supabase.rpc("close_job", { p_order_id: id });
    if (error) failed.push({ id, error: workflowErrorMessage(error) });
    else closed += 1;
  }
  revalidatePath("/", "layout");
  return { ok: true, closed, failed };
}

const resolveSchema = z.object({
  flagId: z.uuid(),
  note: z.string().trim().min(3, "Add a short resolution note.").max(1000),
});

/** Resolves an AI Supervisor flag. RLS ("ai flags manager resolve") limits this to managers/admins. */
export async function resolveFlag(input: z.input<typeof resolveSchema>): Promise<ActionResult> {
  const user = await requireUser(["manager", "admin"]);
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_flags")
    .update({
      resolved: true,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: parsed.data.note,
    })
    .eq("id", parsed.data.flagId)
    .eq("resolved", false)
    .select("id");
  if (error) return { ok: false, error: workflowErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "This flag was already resolved or is no longer visible to you." };

  revalidatePath("/", "layout");
  return { ok: true };
}
