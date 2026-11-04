import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CompleteWizard } from "@/components/tech/complete/complete-wizard";
import { EMPTY_DRAFT, type CompletionOutcome, type Draft, type ExistingMedia, type ExistingReceipt } from "@/components/tech/complete/types";
import { requireUser } from "@/lib/auth";
import { getOrderDetail } from "@/lib/data/orders";

export const metadata: Metadata = { title: "Complete job" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN = new Set(["assigned", "in_progress", "rework"]);

export default async function CompleteJobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["technician"]);
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const { order, attachments, completion, notifications, review } = detail;
  // The job must be started on site before it can be completed.
  if (order.status === "assigned") redirect(`/tech/jobs/${order.id}?start=first`);

  // Already completed (or just completed and re-rendered): the wizard shows its success screen.
  let completed: CompletionOutcome | null = null;
  if (!OPEN.has(order.status)) {
    if (!completion) notFound();
    const feedback = notifications.find((n) => n.template === "job_done_customer_feedback" && n.deep_link);
    completed = {
      finalAmount: completion.final_amount,
      completedAt: completion.completed_at,
      feedback: feedback ? { id: feedback.id, deepLink: feedback.deep_link! } : null,
    };
  }

  const initialMedia: ExistingMedia[] = attachments
    .filter((a) => a.kind !== "receipt")
    .map((a) => ({
      id: a.id,
      kind: a.kind as ExistingMedia["kind"],
      storagePath: a.storage_path,
      fileName: a.file_name,
      mimeType: a.mime_type,
      sizeBytes: Number(a.size_bytes),
      url: a.url,
      removable: a.uploaded_by === user.id,
    }));

  const lastReceipt = attachments.filter((a) => a.kind === "receipt").at(-1);
  const initialReceipt: ExistingReceipt | null = lastReceipt
    ? { id: lastReceipt.id, storagePath: lastReceipt.storage_path, url: lastReceipt.url }
    : null;

  // Sent back by the manager: show their note and pre-fill the previous submission.
  let rework: { note: string | null; by: string | null; previous: Draft } | null = null;
  if (order.status === "rework") {
    const paid = completion && completion.payment_method && completion.payment_method !== "unpaid";
    rework = {
      note: review?.decision === "rework" ? (review.notes ?? null) : null,
      by: reworkBy(detail.events),
      previous: completion
        ? {
            ...EMPTY_DRAFT,
            workDone: completion.work_done ?? "",
            extraCharges: Number(completion.extra_charges) > 0 ? String(completion.extra_charges) : "",
            remarks: completion.remarks ?? "",
            paymentEnabled: !!paid,
            paymentAmount: paid && completion.payment_amount !== null ? String(completion.payment_amount) : null,
            paymentMethod: paid ? completion.payment_method : null,
          }
        : EMPTY_DRAFT,
    };
  }

  return (
    <CompleteWizard
      order={{
        id: order.id,
        orderNo: order.order_no,
        serviceName: order.service_type?.name ?? "Aircon service",
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        quotedPrice: order.quoted_price,
      }}
      technicianName={order.technician?.name ?? user.fullName}
      userId={user.id}
      initialMedia={initialMedia}
      initialReceipt={initialReceipt}
      completed={completed}
      rework={rework}
    />
  );
}

function reworkBy(events: { action: string; actor_name: string | null }[]) {
  return [...events].reverse().find((e) => e.action === "rework_requested")?.actor_name ?? null;
}
