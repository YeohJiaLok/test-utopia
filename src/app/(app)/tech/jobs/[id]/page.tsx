import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  Info,
  FileText,
  MapPin,
  Phone,
  Receipt,
  RotateCcw,
  StickyNote,
  Timer,
  Wallet,
} from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatusPipeline } from "@/components/shared/status-pipeline";
import { AttachmentGallery } from "@/components/orders/attachment-gallery";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { WhatsAppButton } from "@/components/orders/whatsapp-button";
import { BottomBarSpacer } from "@/components/tech/bottom-bar";
import { CustomerActions } from "@/components/tech/contact-actions";
import { JobActionBar, JobActionPanel } from "@/components/tech/job-action-bar";
import { SectionCard } from "@/components/tech/section-card";
import { countdownLabel, scheduleLabel } from "@/components/tech/lib";
import { requireUser } from "@/lib/auth";
import { getOrderDetail } from "@/lib/data/orders";
import { formatDateTime, formatMYR } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { telLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Job details" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TechJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(["technician"]);
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  const { order, completion, attachments, receiptUrl, events, reschedules, review, notifications } = detail;
  const open = order.status === "assigned" || order.status === "in_progress" || order.status === "rework";
  const done = !open && !!completion;
  const service = order.service_type?.name ?? "Aircon service";
  const techName = order.technician?.name ?? user.fullName;
  const feedback = notifications.find((n) => n.template === "job_done_customer_feedback" && n.deep_link);
  const countdown = order.status === "assigned" ? countdownLabel(order.scheduled_at) : null;
  const rework = order.status === "rework" && review?.decision === "rework" ? review : null;
  const reworkBy = rework ? ([...events].reverse().find((e) => e.action === "rework_requested")?.actor_name ?? null) : null;

  return (
    <div>
      <Link
        href="/tech"
        className="text-muted-foreground hover:text-foreground -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium lg:hidden"
      >
        <ChevronLeft className="size-4" /> My jobs
      </Link>

      <Stagger
        className="mt-1 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_400px]"
        step={0.06}
      >
        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
          <StaggerItem>
            <section className="bg-card relative overflow-hidden rounded-2xl border p-4 shadow-xs">
              <div className="bg-gradient-brand absolute inset-x-0 top-0 h-1" aria-hidden />
              <div
                className="bg-primary/10 pointer-events-none absolute -top-16 -right-16 size-44 rounded-full blur-3xl"
                aria-hidden
              />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground font-mono text-xs">{order.order_no}</span>
                  <StatusBadge status={order.status} />
                </div>
                <h1 className="mt-1.5 text-[22px] leading-tight font-semibold tracking-tight">{service}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <CalendarClock className="size-4" />
                    {scheduleLabel(order.scheduled_at)}
                  </span>
                  {countdown && (
                    <span
                      suppressHydrationWarning
                      className={cn(
                        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold tabular-nums",
                        countdown.late ? "bg-amber-500/12 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary",
                      )}
                    >
                      <Timer className="size-3" />
                      {countdown.label}
                    </span>
                  )}
                  {order.reschedule_count > 0 && (
                    <span className="inline-flex h-6 items-center rounded-full bg-orange-500/10 px-2 text-[11px] font-medium text-orange-700 dark:text-orange-300">
                      Rescheduled ×{order.reschedule_count}
                    </span>
                  )}
                </div>
                <StatusPipeline
                  status={order.status}
                  compact
                  className="mt-5"
                  cancellation={{ at: order.cancelled_at, reason: order.cancel_reason, note: order.cancel_note }}
                />
              </div>
            </section>
          </StaggerItem>
          {order.status === "assigned" && (await searchParams).start === "first" && (
            <StaggerItem>
              <div role="status" className="flex gap-3 rounded-2xl border border-blue-500/25 bg-blue-500/8 p-4 text-sm">
                <Info className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">Start the job first</p>
                  <p className="text-foreground/80 mt-0.5">Tap Start job when you arrive on site. You can complete it once it&apos;s in progress.</p>
                </div>
              </div>
            </StaggerItem>
          )}
          {rework && (
            <StaggerItem>
              <div className="flex gap-3 rounded-2xl border border-orange-500/25 bg-orange-500/8 p-4 text-sm" role="note">
                <RotateCcw className="mt-0.5 size-5 shrink-0 text-orange-600 dark:text-orange-400" />
                <div>
                  <p className="font-semibold text-orange-700 dark:text-orange-300">Sent back for rework{reworkBy ? ` by ${reworkBy}` : ""}</p>
                  <p className="text-foreground/80 mt-0.5">{rework.notes ?? "The manager asked for this job to be redone."}</p>
                </div>
              </div>
            </StaggerItem>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          {open && (
            <StaggerItem className="hidden lg:block">
              <JobActionPanel
                orderId={order.id}
                orderNo={order.order_no}
                status={order.status}
                scheduledAt={order.scheduled_at}
              />
            </StaggerItem>
          )}
          <StaggerItem>
            <SectionCard title="Customer">
              <div className="flex items-center gap-3">
                <span className="bg-accent text-accent-foreground flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {initials(order.customer_name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{order.customer_name}</p>
                  <a
                    href={telLink(order.customer_phone)}
                    className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm tabular-nums"
                  >
                    <Phone className="size-3.5" /> {order.customer_phone}
                  </a>
                </div>
              </div>
              <div className="bg-muted/50 mt-3 flex items-start gap-2.5 rounded-xl p-3 text-sm">
                <MapPin className="text-primary mt-0.5 size-4 shrink-0" />
                <span className="leading-snug">
                  {order.customer_address}
                  {order.branch && <span className="text-muted-foreground"> · {order.branch.name}</span>}
                </span>
              </div>
              <div className="mt-3">
                <CustomerActions
                  phone={order.customer_phone}
                  address={order.customer_address}
                  whatsappMessage={`Hi ${order.customer_name}, this is ${techName} from Sejuk Sejuk regarding your aircon service (${order.order_no}).`}
                />
              </div>
            </SectionCard>
          </StaggerItem>
        </aside>

        <div className="space-y-4 lg:col-start-1 lg:row-start-2">
          <StaggerItem>
            <SectionCard title="Job">
              <div className="space-y-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Problem reported</p>
                  <p className="mt-1 text-sm whitespace-pre-line">{order.problem_description}</p>
                </div>
                {order.admin_notes && (
                  <div className="flex gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/8 p-3 text-sm">
                    <StickyNote className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Notes from the office</p>
                      <p className="mt-0.5 whitespace-pre-line">{order.admin_notes}</p>
                    </div>
                  </div>
                )}
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <dt className="text-muted-foreground text-xs">Service</dt>
                    <dd className="mt-0.5 font-medium">{service}</dd>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <dt className="text-muted-foreground text-xs">Quoted price</dt>
                    <dd className="mt-0.5 text-base font-semibold tabular-nums">{formatMYR(order.quoted_price)}</dd>
                  </div>
                </dl>
              </div>
            </SectionCard>
          </StaggerItem>

          {done && completion && (
            <StaggerItem>
              <SectionCard
                title="Completion"
                aside={<span className="text-muted-foreground text-xs">{formatDateTime(completion.completed_at)}</span>}
              >
                <div className="bg-gradient-brand rounded-xl p-4 text-white">
                  <p className="text-xs font-medium text-white/80">Final amount</p>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatMYR(completion.final_amount)}</p>
                  <p className="mt-1 text-xs text-white/85 tabular-nums">
                    Quoted {formatMYR(completion.quoted_price)} + extra {formatMYR(completion.extra_charges)}
                  </p>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                      <ClipboardList className="size-3.5" /> Work done
                    </p>
                    <p className="mt-1 whitespace-pre-line">{completion.work_done}</p>
                  </div>
                  {completion.remarks && (
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                        <FileText className="size-3.5" /> Remarks
                      </p>
                      <p className="mt-1 whitespace-pre-line">{completion.remarks}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                    <span className="flex items-center gap-2">
                      <Wallet className="text-muted-foreground size-4" />
                      {completion.payment_method ? PAYMENT_METHOD_LABELS[completion.payment_method] : "Payment not recorded"}
                      {completion.payment_amount !== null && completion.payment_method !== "unpaid" && (
                        <span className="font-semibold tabular-nums">· {formatMYR(completion.payment_amount)}</span>
                      )}
                    </span>
                    {receiptUrl && (
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex min-h-9 items-center gap-1.5 text-sm font-medium"
                      >
                        <Receipt className="size-4" /> Receipt
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-muted-foreground mb-2 text-xs font-medium">Photos, videos & documents</p>
                  <AttachmentGallery attachments={attachments} className="grid-cols-3 sm:grid-cols-4 xl:grid-cols-5" />
                </div>

                {feedback?.deep_link && (
                  <div className="mt-4 space-y-1.5">
                    <WhatsAppButton
                      href={feedback.deep_link}
                      notificationId={feedback.id}
                      className="h-12 w-full rounded-xl text-[15px]"
                    >
                      Send feedback request to customer
                    </WhatsAppButton>
                    <p className="text-muted-foreground text-center text-xs">
                      {feedback.status === "pending" ? "Not sent yet" : "Opened before"} · message prepared by Sejuk Ops
                    </p>
                  </div>
                )}

                {review && review.decision === "approved" && (
                  <p className="mt-4 rounded-xl bg-teal-500/8 px-3 py-2 text-sm text-teal-800 dark:text-teal-300">
                    Approved by manager
                    {review.rating ? ` · ${"★".repeat(review.rating)}` : ""}
                    {review.notes ? ` — “${review.notes}”` : ""}
                  </p>
                )}
              </SectionCard>
            </StaggerItem>
          )}

          {reschedules.length > 0 && (
            <StaggerItem>
              <SectionCard title="Reschedules">
                <ul className="space-y-3 text-sm">
                  {reschedules.map((r) => (
                    <li key={r.id} className="flex gap-3">
                      <CalendarClock className="mt-0.5 size-4 shrink-0 text-orange-600 dark:text-orange-400" />
                      <div className="min-w-0">
                        <p className="font-medium">{r.reason}</p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {r.old_scheduled_at ? formatDateTime(r.old_scheduled_at) : "Unscheduled"} →{" "}
                          {formatDateTime(r.new_scheduled_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </StaggerItem>
          )}

          <StaggerItem>
            <SectionCard title="Activity">
              <OrderTimeline events={events} />
            </SectionCard>
          </StaggerItem>
        </div>
      </Stagger>

      {open && (
        <>
          <BottomBarSpacer />
          <JobActionBar orderId={order.id} orderNo={order.order_no} status={order.status} scheduledAt={order.scheduled_at} />
        </>
      )}
    </div>
  );
}
