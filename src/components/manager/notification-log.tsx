import { BellRing, ExternalLink } from "lucide-react";
import { WhatsAppIcon } from "@/components/orders/whatsapp-button";
import type { Notification } from "@/lib/types";
import { formatDateTime, formatRelative, maskPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

const AUDIENCE: Record<Notification["audience"], string> = {
  customer: "Customer",
  technician: "Technician",
  manager: "Manager",
  accounts: "Accounts",
};

const STATUS: Record<Notification["status"], string> = {
  pending: "bg-muted text-muted-foreground",
  opened: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  sent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  read: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

/** WhatsApp messages generated for this order (DB triggers), newest first. */
export function NotificationLog({ notifications }: { notifications: Notification[] }) {
  const items = notifications.filter((n) => n.channel === "whatsapp");
  if (!items.length) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <BellRing className="size-4" /> No WhatsApp messages generated for this order yet.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((n) => (
        <li key={n.id} className="flex gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#25D366]/12 text-[#128C7E] dark:text-[#25D366]">
            <WhatsAppIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-medium">{n.title}</p>
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-px text-[10px] font-medium uppercase">
                {AUDIENCE[n.audience]}
              </span>
              <span className={cn("rounded px-1.5 py-px text-[10px] font-medium capitalize", STATUS[n.status])}>{n.status}</span>
            </div>
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs whitespace-pre-line">{n.message}</p>
            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-[11px]">
              <time dateTime={n.created_at} title={formatDateTime(n.created_at)}>
                {formatRelative(n.created_at)}
              </time>
              {n.recipient_phone && <span className="tabular">· {maskPhone(n.recipient_phone)}</span>}
              {n.deep_link && (
                <a
                  href={n.deep_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-0.5 hover:underline"
                >
                  Open link <ExternalLink className="size-3" />
                </a>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
