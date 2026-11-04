"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BellOff, CheckCheck, CheckCircle2, ClipboardCheck, Loader2, MessageCircle, Wrench, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { EASE } from "@/components/motion";
import { formatDateTime, formatRelative } from "@/lib/format";
import { orderHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { AppRole, Notification } from "@/lib/types";
import { markAllNotificationsRead, markNotificationsRead } from "@/app/(app)/shell-actions";

const ICON: Record<string, typeof Wrench> = {
  job_done_review: ClipboardCheck,
  job_assigned_in_app: Wrench,
  job_cancelled_in_app: XCircle,
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const key = (x: Date) => x.toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur" });
  if (key(d) === key(today)) return "Today";
  const y = new Date(today.getTime() - 864e5);
  if (key(d) === key(y)) return "Yesterday";
  return d.toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur", weekday: "short", day: "numeric", month: "short" });
}

/** Full notification list with day groups; opening one marks it read and goes to the order. */
export function NotificationCenter({ items, role, unreadOnly }: { items: Notification[]; role: AppRole; unreadOnly: boolean }) {
  const router = useRouter();
  if (!items.length) {
    return (
      <EmptyState
        icon={unreadOnly ? CheckCircle2 : BellOff}
        className="bg-card py-16"
        title={unreadOnly ? "You're all caught up" : "No notifications yet"}
        description={unreadOnly ? "Nothing unread. Older alerts are under All." : "Alerts about your jobs and reviews will appear here."}
      />
    );
  }

  const groups: [string, Notification[]][] = [];
  for (const n of items) {
    const g = dayLabel(n.created_at);
    const last = groups.at(-1);
    if (last && last[0] === g) last[1].push(n);
    else groups.push([g, [n]]);
  }

  return (
    <div className="space-y-4">
      {groups.map(([label, rows]) => (
        <section key={label}>
          <h2 className="text-muted-foreground mb-1.5 px-1 text-[11px] font-medium tracking-wide uppercase">{label}</h2>
          <ul className="bg-card divide-y overflow-hidden rounded-xl border shadow-xs">
            {rows.map((n, i) => {
              const Icon = ICON[n.template] ?? MessageCircle;
              const unread = n.status !== "read";
              return (
                <motion.li key={n.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE, delay: Math.min(i, 8) * 0.02 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (unread) void markNotificationsRead([n.id]);
                      if (n.order_id) router.push(orderHref(role, n.order_id));
                      else router.refresh();
                    }}
                    className={cn("hover:bg-muted/50 flex w-full gap-3 px-4 py-3 text-left transition-colors", unread && "bg-primary/[0.03]")}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                        unread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>{n.title}</span>
                        {unread && <span className="bg-primary size-2 shrink-0 rounded-full" aria-label="Unread" />}
                      </span>
                      <span className="text-muted-foreground line-clamp-2 text-xs">{n.message}</span>
                      <span className="text-muted-foreground/80 mt-1 block text-[11px]" title={formatDateTime(n.created_at)} suppressHydrationWarning>
                        {formatRelative(n.created_at)}
                      </span>
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** "Mark all as read" (a separate export: server pages can't read properties of a client component). */
export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-10 sm:h-9"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          await markAllNotificationsRead();
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark all as read
    </Button>
  );
}
