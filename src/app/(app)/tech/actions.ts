"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { runSupervisor } from "@/lib/ai/supervisor";
import { workflowErrorMessage } from "@/lib/workflow";
import { fromMytInputValue, round2 } from "@/components/tech/lib";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const orderId = z.guid("Invalid order");

function revalidateJob(id: string) {
  // Deliberately not revalidating /tech/jobs/[id]/complete so the wizard's success screen stays mounted.
  revalidatePath("/tech");
  revalidatePath("/tech/history");
  revalidatePath(`/tech/jobs/${id}`);
}

/** Technician arrives on site: assigned → in_progress (rpc start_job). */
export async function startJobAction(id: string): Promise<ActionResult> {
  await requireUser(["technician"]);
  const parsed = orderId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid order" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_job", { p_order_id: parsed.data });
  if (error) return { ok: false, error: workflowErrorMessage(error) };

  revalidateJob(parsed.data);
  return { ok: true, data: undefined };
}

const rescheduleSchema = z.object({
  orderId,
  /** `datetime-local` value in Malaysia time, e.g. 2026-11-04T10:30 */
  scheduledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a valid date and time"),
  reason: z.string().trim().min(3, "Tell us why the job is being rescheduled").max(500),
});

/** Postpone a job to a new slot with a reason (rpc reschedule_order). */
export async function rescheduleJobAction(input: z.input<typeof rescheduleSchema>): Promise<ActionResult<{ scheduledAt: string }>> {
  await requireUser(["technician"]);
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };

  const when = fromMytInputValue(parsed.data.scheduledAt);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Pick a valid date and time" };
  if (when.getTime() < Date.now() - 5 * 60 * 1000) return { ok: false, error: "The new slot must be in the future" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reschedule_order", {
    p_order_id: parsed.data.orderId,
    p_new_scheduled_at: when.toISOString(),
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: workflowErrorMessage(error) };

  revalidateJob(parsed.data.orderId);
  return { ok: true, data: { scheduledAt: (data as { scheduled_at?: string } | null)?.scheduled_at ?? when.toISOString() } };
}

const paymentMethod = z.enum(["cash", "card", "bank_transfer", "ewallet", "unpaid"]);

const completeSchema = z
  .object({
    orderId,
    workDone: z.string().trim().min(3, "Describe the work done").max(4000),
    extraCharges: z.number().min(0, "Extra charges cannot be negative").max(100000),
    remarks: z.string().trim().max(2000).optional(),
    payment: z
      .object({
        amount: z.number().min(0).max(100000),
        method: paymentMethod,
        receiptPath: z.string().max(512).nullable(),
      })
      .nullable(),
  })
  .refine((v) => v.extraCharges === 0 || (v.remarks?.length ?? 0) > 0, {
    message: "Explain the extra charges in remarks",
    path: ["remarks"],
  })
  .refine((v) => !v.payment?.receiptPath || v.payment.receiptPath.startsWith(`${v.orderId}/`), {
    message: "Receipt does not belong to this job",
    path: ["payment"],
  });

export type CompleteJobInput = z.input<typeof completeSchema>;

export interface CompleteJobResult {
  finalAmount: number;
  completedAt: string;
  feedback: { id: string; deepLink: string } | null;
}

/** Module 2: submit the service job form (rpc complete_job), then hand off to the AI supervisor. */
export async function completeJobAction(input: CompleteJobInput): Promise<ActionResult<CompleteJobResult>> {
  await requireUser(["technician"]);
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_job", {
    p_order_id: v.orderId,
    p_work_done: v.workDone,
    p_extra_charges: round2(v.extraCharges),
    p_remarks: v.remarks || null,
    p_payment_amount: v.payment ? round2(v.payment.amount) : null,
    p_payment_method: v.payment?.method ?? null,
    p_receipt_path: v.payment?.receiptPath ?? null,
  });
  if (error) return { ok: false, error: workflowErrorMessage(error) };

  const completion = data as { final_amount?: number | string; completed_at?: string } | null;

  // Module 3: the DB trigger rendered the customer feedback WhatsApp message on job_done.
  const { data: notification } = await supabase
    .from("notifications")
    .select("id, deep_link")
    .eq("order_id", v.orderId)
    .eq("template", "job_done_customer_feedback")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Workflow Supervisor reviews the completion without blocking the technician.
  after(async () => {
    try {
      await runSupervisor(v.orderId);
    } catch (e) {
      console.error("[supervisor] post-completion review failed", v.orderId, e);
    }
  });

  revalidateJob(v.orderId);

  return {
    ok: true,
    data: {
      finalAmount: Number(completion?.final_amount ?? 0),
      completedAt: completion?.completed_at ?? new Date().toISOString(),
      feedback: notification?.deep_link ? { id: notification.id as string, deepLink: notification.deep_link as string } : null,
    },
  };
}
