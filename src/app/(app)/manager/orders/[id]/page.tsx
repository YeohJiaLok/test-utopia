import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  ExternalLink,
  History,
  MapPin,
  MessageCircle,
  Phone,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrderDetail } from "@/lib/data/orders";
import { PAYMENT_METHOD_LABELS } from "@/lib/workflow";
import { formatDateTime, formatMYR, maskPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatusPipeline } from "@/components/shared/status-pipeline";
import { AttachmentGallery } from "@/components/orders/attachment-gallery";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { ChartCard } from "@/components/manager/chart-card";
import { FlagCard } from "@/components/manager/flag-card";
import { NotificationLog } from "@/components/manager/notification-log";
import { ResolveFlagDialog } from "@/components/manager/resolve-flag-dialog";
import { ReviewPanel } from "@/components/manager/review-panel";
import { getQueueIds } from "../../_lib/queries";

export const metadata: Metadata = { title: "Review order" };

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5 text-sm", className)}>
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="tabular text-right">{children}</dd>
    </div>
  );
}

export default async function ReviewWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["manager", "admin"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [detail, queueIds] = await Promise.all([getOrderDetail(id), getQueueIds()]);
  if (!detail) notFound();

  const { order, completion, attachments, events, review, flags, notifications, reschedules, receiptUrl } = detail;
  const openFlags = flags
    .filter((f) => !f.resolved)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const resolvedFlags = flags.filter((f) => f.resolved);

  const idx = queueIds.indexOf(order.id);
  const queue = {
    position: idx + 1,
    total: queueIds.length,
    prevId: idx > 0 ? queueIds[idx - 1]! : null,
    nextId: idx >= 0 ? (queueIds[idx + 1] ?? null) : (queueIds[0] ?? null),
  };

  const photos = attachments.filter((a) => a.kind === "photo").length;
  const extraPct = completion && completion.quoted_price > 0 ? (completion.extra_charges / completion.quoted_price) * 100 : 0;
  const paymentGap =
    completion && completion.payment_amount !== null && completion.payment_method !== "unpaid"
      ? completion.payment_amount - completion.final_amount
      : 0;

  return (
    <div className="space-y-6">
      <FadeIn className="space-y-4">
        <Link href="/manager/reviews" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium">
          <ArrowLeft className="size-3.5" /> Review queue
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">{order.order_no}</h1>
              <StatusBadge status={order.status} />
              {openFlags.length > 0 && (
                <a
                  href="#ai-flags"
                  className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-500/12 px-2.5 text-xs font-medium text-amber-700 ring-1 ring-amber-500/25 ring-inset dark:text-amber-300"
                >
                  <ShieldAlert className="size-3" /> {openFlags.length} open flag{openFlags.length > 1 ? "s" : ""}
                </a>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {order.service_type?.name ?? "Service"} for <span className="text-foreground font-medium">{order.customer_name}</span>
              {order.branch ? ` · ${order.branch.name}` : ""}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border px-2 py-4 sm:px-4">
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
        </div>
      </FadeIn>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {(openFlags.length > 0 || resolvedFlags.length > 0) && (
            <section id="ai-flags" className="scroll-mt-24 space-y-3" aria-labelledby="flags-title">
              <div className="flex items-center justify-between gap-2">
                <h2 id="flags-title" className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-300">
                    <ShieldAlert className="size-4" />
                  </span>
                  AI Supervisor findings
                </h2>
                <span className="text-muted-foreground text-xs">
                  {openFlags.length} open · {resolvedFlags.length} resolved
                </span>
              </div>
              <div className="space-y-3">
                {openFlags.map((f, i) => (
                  <FadeIn key={f.id} delay={0.05 * i}>
                    <FlagCard flag={f} action={<ResolveFlagDialog flagId={f.id} title={f.title} />} />
                  </FadeIn>
                ))}
                {resolvedFlags.map((f) => (
                  <FlagCard key={f.id} flag={f} className="opacity-80" />
                ))}
              </div>
            </section>
          )}
          {flags.length === 0 && completion && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm">
              <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <span className="font-medium">No supervisor findings.</span>{" "}
                <span className="text-muted-foreground">Rule checks and the AI reviewer found nothing unusual.</span>
              </span>
            </div>
          )}

          <ChartCard
            title="Completion report"
            description={
              completion
                ? `Submitted by ${order.technician?.name ?? "technician"} · ${formatDateTime(completion.completed_at)}`
                : "The technician has not submitted a completion yet"
            }
          >
            {completion ? (
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-muted-foreground mb-1 text-xs font-medium">Work done</h3>
                    <p className="text-sm whitespace-pre-line">{completion.work_done}</p>
                  </div>
                  {completion.remarks && (
                    <div>
                      <h3 className="text-muted-foreground mb-1 text-xs font-medium">Remarks</h3>
                      <p className="text-sm whitespace-pre-line">{completion.remarks}</p>
                    </div>
                  )}
                  <div>
                    <h3 className="text-muted-foreground mb-1 text-xs font-medium">Original problem</h3>
                    <p className="text-muted-foreground text-sm">{order.problem_description}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <dl className="bg-muted/40 divide-y rounded-lg border px-3">
                    <Row label="Quoted">{formatMYR(completion.quoted_price)}</Row>
                    <Row label="Extra charges">
                      <span className={cn(completion.extra_charges > 0 && "font-medium text-amber-700 dark:text-amber-300")}>
                        + {formatMYR(completion.extra_charges)}
                        {completion.extra_charges > 0 && <span className="ml-1 text-xs">({extraPct.toFixed(0)}%)</span>}
                      </span>
                    </Row>
                    <Row label="Final amount" className="font-semibold">
                      <span className="text-base">{formatMYR(completion.final_amount)}</span>
                    </Row>
                  </dl>
                  <dl className="divide-y rounded-lg border px-3">
                    <Row label="Payment">
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="text-muted-foreground size-3.5" />
                        {completion.payment_method ? PAYMENT_METHOD_LABELS[completion.payment_method] : "—"}
                      </span>
                    </Row>
                    <Row label="Collected">
                      {completion.payment_amount !== null ? formatMYR(completion.payment_amount) : "—"}
                      {paymentGap !== 0 && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-red-500/10 px-1 text-[11px] font-medium text-red-700 dark:text-red-300">
                          <AlertTriangle className="size-3" />
                          {paymentGap > 0 ? "+" : "−"}
                          {formatMYR(Math.abs(paymentGap))}
                        </span>
                      )}
                    </Row>
                    <Row label="Receipt">
                      {receiptUrl ? (
                        <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                          <Receipt className="size-3.5" /> View receipt <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Not uploaded</span>
                      )}
                    </Row>
                    <Row label="Technician">
                      <span className="inline-flex items-center gap-1">
                        <User className="text-muted-foreground size-3.5" />
                        {order.technician?.name ?? "—"}
                        {order.technician?.team_code && <span className="text-muted-foreground text-xs">· {order.technician.team_code}</span>}
                      </span>
                    </Row>
                    <Row label="Completed">{formatDateTime(completion.completed_at)}</Row>
                  </dl>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <ClipboardList className="size-4" /> Waiting for the technician to complete the job.
              </p>
            )}
          </ChartCard>

          <ChartCard
            title="Evidence"
            description={`${photos} photo${photos === 1 ? "" : "s"} · ${attachments.filter((a) => a.kind !== "receipt").length} file(s) in total`}
            action={
              photos === 0 && completion ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">
                  <Camera className="size-3" /> No photos
                </span>
              ) : undefined
            }
          >
            <AttachmentGallery attachments={attachments} />
          </ChartCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="Activity timeline" description="Append-only audit trail from the workflow engine">
              <OrderTimeline events={events} />
            </ChartCard>
            <ChartCard
              title="WhatsApp notifications"
              description="Messages generated for customer, technician and accounts"
              action={<MessageCircle className="text-muted-foreground size-4" />}
            >
              <NotificationLog notifications={notifications} />
            </ChartCard>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <FadeIn delay={0.1}>
            <ReviewPanel
              orderId={order.id}
              orderNo={order.order_no}
              status={order.status}
              role={user.role}
              review={review}
              reviewedAt={order.reviewed_at}
              closedAt={order.closed_at}
              openFlags={openFlags.map((f) => ({ severity: f.severity }))}
              queue={queue}
            />
          </FadeIn>
          <FadeIn delay={0.16}>
            <section className="bg-card space-y-2.5 rounded-xl border p-4 text-sm">
              <h2 className="text-sm font-semibold">Customer & job</h2>
              <p className="flex items-start gap-2">
                <User className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                {order.customer_name}
              </p>
              <p className="flex items-start gap-2">
                <Phone className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <span className="tabular">{maskPhone(order.customer_phone)}</span>
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <span className="text-muted-foreground">{order.customer_address}</span>
              </p>
              <p className="flex items-start gap-2">
                <CalendarClock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <span>
                  {order.scheduled_at ? formatDateTime(order.scheduled_at) : "Not scheduled"}
                  {order.reschedule_count > 0 && (
                    <span className="ml-1.5 rounded bg-amber-500/12 px-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                      Rescheduled ×{order.reschedule_count}
                    </span>
                  )}
                </span>
              </p>
              {reschedules[0] && (
                <p className="text-muted-foreground flex items-start gap-2 text-xs">
                  <History className="mt-0.5 size-3.5 shrink-0" />
                  Last reason: {reschedules[0].reason}
                </p>
              )}
              {order.admin_notes && (
                <p className="bg-muted/60 text-muted-foreground rounded-md px-2.5 py-2 text-xs">
                  <span className="text-foreground font-medium">Admin notes: </span>
                  {order.admin_notes}
                </p>
              )}
              <p className="text-muted-foreground flex items-center gap-2 border-t pt-2.5 text-xs">
                <CheckCircle2 className="size-3.5" /> Quoted {formatMYR(order.quoted_price)} · created {formatDateTime(order.created_at)}
              </p>
            </section>
          </FadeIn>
        </aside>
      </div>
    </div>
  );
}
