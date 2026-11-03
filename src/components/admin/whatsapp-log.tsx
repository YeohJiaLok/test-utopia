import Link from "next/link";
import { MessageCircle } from "lucide-react";
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
  return (
    <article className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="bg-muted rounded-md px-1.5 py-0.5 text-[11px] font-medium">{AUDIENCE_LABEL[n.audience]}</span>
        <span className="text-sm font-medium">{TEMPLATE_LABEL[n.template] ?? n.title}</span>
        {showOrder && order && (
          <Link href={`/admin/orders/${order.id}`} className="text-primary font-mono text-xs font-semibold hover:underline">
            {order.order_no}
          </Link>
        )}
        <NotificationStatusChip status={n.status} className="ml-auto" />
      </div>
      <p className="text-muted-foreground text-xs">
        To {maskPhone(n.recipient_phone)} ·{" "}
        <time dateTime={n.created_at} title={formatDateTime(n.created_at)}>
          {formatRelative(n.created_at)}
        </time>
      </p>
      <p
        className={cn(
          "bg-muted/50 rounded-lg border-l-2 border-[#25D366] px-3 py-2 text-xs leading-relaxed whitespace-pre-line",
          compact ? "line-clamp-4" : "line-clamp-6",
        )}
      >
        {n.message}
      </p>
      {n.deep_link && (
        <WhatsAppButton href={n.deep_link} notificationId={n.id} size="sm" className="h-7">
          {n.status === "pending" ? "Open in WhatsApp" : "Resend"}
        </WhatsAppButton>
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
