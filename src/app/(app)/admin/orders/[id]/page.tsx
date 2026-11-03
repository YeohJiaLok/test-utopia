import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  History,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  UserX,
  Wrench,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrderDetail } from "@/lib/data/orders";
import { getTechniciansWithLoad, type TechnicianWithLoad } from "@/lib/data/reference";
import { canPerform, PAYMENT_METHOD_LABELS, STATUS_META } from "@/lib/workflow";
import { formatDateTime, formatMYR, formatRelative, initials } from "@/lib/format";
import { mapsLink, telLink, wazeLink, whatsappLink } from "@/lib/whatsapp";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, SeverityBadge } from "@/components/shared/status-badge";
import { StatusPipeline } from "@/components/shared/status-pipeline";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { AttachmentGallery } from "@/components/orders/attachment-gallery";
import { WhatsAppIcon } from "@/components/orders/whatsapp-button";
import { FadeIn } from "@/components/motion";
import { DetailCard, DetailRow } from "@/components/admin/detail-card";
import { AssignTechnicianDialog, CloseJobButton, RescheduleDialog } from "@/components/admin/order-actions";
import { WhatsAppLogEmpty, WhatsAppMessage } from "@/components/admin/whatsapp-log";
import { cn } from "@/lib/utils";

export const metadata = { title: "Order details · Sejuk Ops" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["admin", "manager"]);
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const { order, completion, attachments, receiptUrl, events, reschedules, review, flags, notifications } = detail;

  const ctx = { status: order.status, role: user.role, isAssignedTechnician: false };
  const canAssign = canPerform("assign", ctx);
  const canReassign = canPerform("reassign", ctx);
  const canReschedule = canPerform("reschedule", ctx);
  const canClose = canPerform("close", ctx);
  const technicians: TechnicianWithLoad[] = canAssign || canReassign ? await getTechniciansWithLoad() : [];

  const whatsapp = notifications.filter((n) => n.channel === "whatsapp");
  const openFlags = flags.filter((f) => !f.resolved);
  const reviewer = [...events].reverse().find((e) => e.action === "job_reviewed" || e.action === "rework_requested");
  const paymentGap = completion && completion.payment_amount !== null ? completion.payment_amount - completion.final_amount : null;
  const backHref = user.role === "admin" ? "/admin/orders" : "/manager";

  const hasActions = canReschedule || canAssign || canReassign || canClose;
  const actions = (triggerClassName?: string) => (
    <>
      {canReschedule && (
        <RescheduleDialog orderId={order.id} orderNo={order.order_no} scheduledAt={order.scheduled_at} triggerClassName={triggerClassName} />
      )}
      {(canAssign || canReassign) && (
        <AssignTechnicianDialog
          orderId={order.id}
          orderNo={order.order_no}
          currentTechnicianId={order.assigned_technician_id}
          branchId={order.branch_id}
          technicians={technicians}
          mode={canAssign ? "assign" : "reassign"}
          triggerClassName={triggerClassName}
        />
      )}
      {canClose && <CloseJobButton orderId={order.id} orderNo={order.order_no} triggerClassName={triggerClassName} />}
    </>
  );

  // Contact cards: in the side rail on desktop, right under the pipeline on phones/tablets.
  const customerCard = (
    <DetailCard icon={User} title="Customer">
      <div className="space-y-3">
        <div>
          <p className="font-medium">{order.customer_name}</p>
          <p className="text-muted-foreground text-sm tabular">{order.customer_phone}</p>
        </div>
        <p className="flex gap-1.5 text-sm">
          <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <span>{order.customer_address}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <a href={telLink(order.customer_phone)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-11 lg:h-8")}>
            <Phone /> Call
          </a>
          <a
            href={whatsappLink(
              order.customer_phone,
              `Hi ${order.customer_name}, this is Sejuk Sejuk Services regarding your aircon service order ${order.order_no}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-11 lg:h-8")}
          >
            <WhatsAppIcon className="size-3.5 text-[#25D366]" /> WhatsApp
          </a>
          <a
            href={mapsLink(order.customer_address)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-11 lg:h-8")}
          >
            <MapPin /> Maps
          </a>
          <a
            href={wazeLink(order.customer_address)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-11 lg:h-8")}
          >
            <Navigation /> Waze
          </a>
        </div>
      </div>
    </DetailCard>
  );
  const technicianCard = (
    <DetailCard icon={Wrench} title="Technician">
      {order.technician ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full text-sm font-semibold">
              {initials(order.technician.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{order.technician.name}</p>
              <p className="text-muted-foreground text-xs">
                {order.technician.team_code} · <span className="tabular">{order.technician.phone}</span>
              </p>
            </div>
          </div>
          {order.assigned_at && (
            <p className="text-muted-foreground text-xs tabular">Assigned {formatDateTime(order.assigned_at)}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <a href={telLink(order.technician.phone)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-11 lg:h-8")}>
              <Phone /> Call
            </a>
            <a
              href={whatsappLink(order.technician.phone, `Hi ${order.technician.name}, regarding job ${order.order_no}: `)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-11 lg:h-8")}
            >
              <WhatsAppIcon className="size-3.5 text-[#25D366]" /> Message
            </a>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <UserX className="size-4" /> Not assigned yet
        </div>
      )}
    </DetailCard>
  );

  return (
    <div className={cn("space-y-6", hasActions && "pb-20 lg:pb-0")}>
      <FadeIn className="space-y-4">
        <Link href={backHref} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors">
          <ArrowLeft className="size-4" /> {user.role === "admin" ? "All orders" : "Dashboard"}
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">{order.order_no}</h1>
              <StatusBadge status={order.status} />
              {order.source === "ai_document" && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-violet-500/10 px-2.5 text-xs font-medium text-violet-700 ring-1 ring-violet-500/20 ring-inset dark:text-violet-300">
                  <Sparkles className="size-3" /> AI import
                </span>
              )}
              {order.reschedule_count > 0 && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-orange-500/10 px-2.5 text-xs font-medium text-orange-700 ring-1 ring-orange-500/20 ring-inset dark:text-orange-300">
                  <CalendarClock className="size-3" /> Rescheduled ×{order.reschedule_count}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {order.customer_name} · {order.service_type?.name ?? "Service"}
              {order.branch ? ` · ${order.branch.name}` : ""}
            </p>
            <p className="text-muted-foreground text-xs tabular">
              Created {formatDateTime(order.created_at)} · Updated {formatRelative(order.updated_at)}
            </p>
          </div>
          {hasActions && <div className="hidden shrink-0 flex-wrap items-center gap-2 lg:flex">{actions("h-9 px-3 text-sm")}</div>}
        </div>
      </FadeIn>

      <FadeIn delay={0.05} className="bg-card rounded-xl border p-4 pb-3 shadow-xs sm:px-6">
        <StatusPipeline
          status={order.status}
          timestamps={{
            new: order.created_at,
            assigned: order.assigned_at,
            in_progress: order.started_at,
            job_done: order.completed_at,
            reviewed: order.reviewed_at,
            closed: order.closed_at,
          }}
        />
        <p className="text-muted-foreground mt-3 text-center text-xs">{STATUS_META[order.status].description}</p>
      </FadeIn>

      {openFlags.some((f) => f.severity === "high") && (
        <FadeIn delay={0.08} className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.05] p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="text-sm">
            <p className="font-semibold">AI Supervisor raised a high-severity flag on this order</p>
            <p className="text-muted-foreground">Review the flags below before closing.</p>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.08} className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {customerCard}
        {technicianCard}
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <FadeIn delay={0.1}>
            <DetailCard icon={Wrench} title="Job" description={order.service_type?.code}>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                <DetailRow label="Service">{order.service_type?.name ?? "—"}</DetailRow>
                <DetailRow label="Quoted price">
                  <span className="text-base font-semibold tabular">{formatMYR(order.quoted_price)}</span>
                </DetailRow>
                <DetailRow label="Scheduled (MYT)">
                  <span className="tabular">{order.scheduled_at ? formatDateTime(order.scheduled_at) : "Not scheduled"}</span>
                </DetailRow>
                <DetailRow label="Problem description" className="sm:col-span-3">
                  <span className="whitespace-pre-line">{order.problem_description}</span>
                </DetailRow>
                <DetailRow label="Admin notes" className="sm:col-span-3">
                  {order.admin_notes ? (
                    <span className="whitespace-pre-line">{order.admin_notes}</span>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </DetailRow>
              </dl>
            </DetailCard>
          </FadeIn>

          <FadeIn delay={0.15}>
            <DetailCard
              icon={CheckCircle2}
              title="Completion"
              description={completion ? `Submitted ${formatDateTime(completion.completed_at)}` : "Filled in by the technician on site"}
            >
              {completion ? (
                <div className="space-y-5">
                  <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <DetailRow label="Work done" className="sm:col-span-2">
                      <span className="whitespace-pre-line">{completion.work_done}</span>
                    </DetailRow>
                    {completion.remarks && (
                      <DetailRow label="Remarks" className="sm:col-span-2">
                        <span className="whitespace-pre-line">{completion.remarks}</span>
                      </DetailRow>
                    )}
                  </dl>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="bg-muted/40 rounded-lg border p-3">
                      <p className="text-muted-foreground mb-2 text-xs font-medium">Amount breakdown</p>
                      <dl className="space-y-1.5 text-sm tabular">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Quoted</dt>
                          <dd>{formatMYR(completion.quoted_price)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Extra charges</dt>
                          <dd>+ {formatMYR(completion.extra_charges)}</dd>
                        </div>
                        <div className="flex justify-between border-t pt-1.5 font-semibold">
                          <dt>Final amount</dt>
                          <dd>{formatMYR(completion.final_amount)}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="bg-muted/40 rounded-lg border p-3">
                      <p className="text-muted-foreground mb-2 text-xs font-medium">Payment</p>
                      <dl className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Collected</dt>
                          <dd className="tabular">{completion.payment_amount !== null ? formatMYR(completion.payment_amount) : "—"}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Method</dt>
                          <dd>{completion.payment_method ? PAYMENT_METHOD_LABELS[completion.payment_method] : "—"}</dd>
                        </div>
                        <div className="flex justify-between border-t pt-1.5">
                          <dt className="text-muted-foreground">Balance</dt>
                          <dd
                            className={cn(
                              "font-medium tabular",
                              paymentGap === null
                                ? "text-muted-foreground"
                                : Math.abs(paymentGap) < 0.005
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-amber-700 dark:text-amber-300",
                            )}
                          >
                            {paymentGap === null
                              ? "—"
                              : Math.abs(paymentGap) < 0.005
                                ? "Settled"
                                : paymentGap < 0
                                  ? `${formatMYR(-paymentGap)} short`
                                  : `${formatMYR(paymentGap)} over`}
                          </dd>
                        </div>
                      </dl>
                      {receiptUrl && (
                        <a
                          href={receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 h-10 w-full sm:h-8")}
                        >
                          <Receipt /> View receipt
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium">
                      Photos, videos & documents ({attachments.filter((a) => a.kind !== "receipt").length}/6)
                    </p>
                    <AttachmentGallery attachments={attachments} />
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {order.status === "new"
                    ? "Assign a technician to get this job started."
                    : "The technician hasn't submitted the completion report yet."}
                </p>
              )}
            </DetailCard>
          </FadeIn>

          <FadeIn delay={0.2}>
            <DetailCard icon={ClipboardCheck} title="Manager review">
              {review ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
                        review.decision === "approved"
                          ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
                          : "bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-300",
                      )}
                    >
                      {review.decision === "approved" ? "Approved" : "Rework requested"}
                    </span>
                    {review.rating !== null && (
                      <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${review.rating} out of 5`}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={cn("size-4", i < review.rating! ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
                          />
                        ))}
                      </span>
                    )}
                    <span className="text-muted-foreground text-xs">
                      {reviewer?.actor_name ? `${reviewer.actor_name} · ` : ""}
                      {formatDateTime(review.created_at)}
                    </span>
                  </div>
                  {review.notes && <p className="bg-muted/40 rounded-lg border p-3 text-sm whitespace-pre-line">{review.notes}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {order.status === "job_done" ? "Awaiting manager review." : "Reviewed by a manager once the job is done."}
                </p>
              )}
            </DetailCard>
          </FadeIn>

          <FadeIn delay={0.25}>
            <DetailCard icon={History} title="Timeline" description="Append-only audit trail">
              <OrderTimeline events={events} />
            </DetailCard>
          </FadeIn>
        </div>

        <div className="min-w-0 space-y-6">
          <FadeIn delay={0.12} className="hidden lg:block">
            {customerCard}
          </FadeIn>
          <FadeIn delay={0.16} className="hidden lg:block">
            {technicianCard}
          </FadeIn>
          <FadeIn delay={0.2}>
            <DetailCard
              icon={openFlags.length ? ShieldAlert : ShieldCheck}
              title="AI Supervisor"
              description={flags.length ? `${openFlags.length} open · ${flags.length - openFlags.length} resolved` : "Workflow & anomaly checks"}
            >
              {flags.length ? (
                <ul className="space-y-3">
                  {flags.map((f) => (
                    <li key={f.id} className={cn("space-y-1 rounded-lg border p-3", f.resolved && "opacity-60")}>
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={f.severity} />
                        <span className="text-muted-foreground text-[11px] uppercase">{f.source === "ai" ? "AI review" : "Rule"}</span>
                        {f.resolved && <span className="ml-auto text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Resolved</span>}
                      </div>
                      <p className="text-sm font-medium">{f.title}</p>
                      <p className="text-muted-foreground text-xs">{f.explanation}</p>
                      {f.recommended_action && !f.resolved && (
                        <p className="text-xs">
                          <span className="font-medium">Recommended: </span>
                          {f.recommended_action}
                        </p>
                      )}
                      {f.resolved && f.resolution_note && <p className="text-xs italic">“{f.resolution_note}”</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <ShieldCheck className="size-4 text-emerald-600" /> No issues detected.
                </p>
              )}
            </DetailCard>
          </FadeIn>

          <FadeIn delay={0.24}>
            <DetailCard icon={MessageCircle} title="WhatsApp log" description={`${whatsapp.length} message${whatsapp.length === 1 ? "" : "s"}`}>
              {whatsapp.length ? (
                <div className="divide-y [&>*]:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
                  {whatsapp.map((n) => (
                    <WhatsAppMessage key={n.id} n={n} compact />
                  ))}
                </div>
              ) : (
                <WhatsAppLogEmpty />
              )}
            </DetailCard>
          </FadeIn>

          {reschedules.length > 0 && (
            <FadeIn delay={0.28}>
              <DetailCard icon={CalendarClock} title="Reschedule history">
                <ol className="space-y-3">
                  {reschedules.map((r) => (
                    <li key={r.id} className="text-sm">
                      <p className="tabular">
                        <span className="text-muted-foreground line-through">{r.old_scheduled_at ? formatDateTime(r.old_scheduled_at) : "Unscheduled"}</span>
                        {" → "}
                        <span className="font-medium">{formatDateTime(r.new_scheduled_at)}</span>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        “{r.reason}” · {formatRelative(r.created_at)}
                      </p>
                    </li>
                  ))}
                </ol>
              </DetailCard>
            </FadeIn>
          )}
        </div>
      </div>

      {hasActions && (
        <div className="bg-background/90 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.15)] backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-2xl gap-2 [&>*]:flex-1">{actions("h-11 text-sm")}</div>
        </div>
      )}
    </div>
  );
}
