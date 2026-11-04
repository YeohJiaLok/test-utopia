import Link from "next/link";
import { Building2, MessageCircle, User, Wrench } from "lucide-react";
import { WhatsAppButton } from "@/components/orders/whatsapp-button";
import { formatDateTime, formatRelative, maskPhone } from "@/lib/format";
import type { Notification, NotificationAudience } from "@/lib/types";
import { cn } from "@/lib/utils";

export const AUDIENCE_LABEL: Record<NotificationAudience, string> = {
  customer: "Customer",
  technician: "Technician",
  manager: "Manager",
  accounts: "Accounts",
};

export const TEMPLATE_LABEL: Record<string, string> = {
  job_assigned_technician: "Job assignment",
  job_done_customer_feedback: "Feedback request",
  job_cancelled_technician: "Job cancelled",
  order_cancelled_customer: "Cancellation notice",
};

const STATUS_STYLE: Record<Notification["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300" },
  opened: { label: "Opened", className: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300" },
  sent: { label: "Sent", className: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300" },
  read: { label: "Read", className: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300" },
};

export function NotificationStatusChip({ status, className }: { status: Notification["status"]; className?: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium ring-1 ring-inset", s.className, className)}>
      {s.label}
    </span>
  );
}

export type OutboxItem = Notification & { order: { id: string; order_no: string } | null };

/** One outbound WhatsApp message: who, what, when, and a button to open / resend it. */
export function WhatsAppMessage({ n, showOrder, compact }: { n: OutboxItem | Notification; showOrder?: boolean; compact?: boolean }) {
  const order = "order" in n ? n.order : null;
  const AudienceIcon = n.audience === "technician" ? Wrench : n.audience === "customer" ? User : Building2;
  return (
    <article className="flex h-full flex-col gap-3">
      <header className="flex items-start gap-3">
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-[#25D366]/12 text-[#128C7E] dark:text-[#25D366]",
            compact ? "size-8" : "size-9",
          )}
          aria-hidden
        >
          <AudienceIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-sm leading-snug font-medium">
              {TEMPLATE_LABEL[n.template] ?? n.title}
              {showOrder && order && (
                <>
                  {" "}
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-primary font-mono text-xs font-semibold whitespace-nowrap hover:underline"
                  >
                    {order.order_no}
                  </Link>
                </>
              )}
            </p>
            <NotificationStatusChip status={n.status} className="shrink-0" />
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {AUDIENCE_LABEL[n.audience]} · <span className="tabular">{maskPhone(n.recipient_phone)}</span> ·{" "}
            <time dateTime={n.created_at} title={formatDateTime(n.created_at)}>
              {formatRelative(n.created_at)}
            </time>
          </p>
        </div>
      </header>
      {/* Chat-bubble preview of the exact text that will be sent */}
      <p
        className={cn(
          "rounded-2xl rounded-tl-sm bg-[#25D366]/[0.08] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line ring-1 ring-[#25D366]/15 ring-inset dark:bg-[#25D366]/[0.1]",
          compact ? "line-clamp-4 text-xs" : "line-clamp-6",
        )}
      >
        {n.message}
      </p>
      {n.deep_link && (
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {n.status === "pending" ? "Waiting to be sent" : ""}
          </span>
          <WhatsAppButton
            href={n.deep_link}
            notificationId={n.id}
            size="sm"
            className={cn("h-10 px-3 sm:h-8", n.status !== "pending" && "opacity-90")}
          >
            {n.status === "pending" ? "Open in WhatsApp" : "Resend"}
          </WhatsAppButton>
        </div>
      )}
    </article>
  );
}

export function WhatsAppLogEmpty() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm">
      <MessageCircle className="size-4" /> No WhatsApp messages for this order yet.
    </div>
  );
}
