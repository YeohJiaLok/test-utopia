"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/format";
import { orderHref } from "@/lib/routes";
import type { AppRole, Notification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { markNotificationsRead } from "@/app/(app)/shell-actions";

/** In-app inbox with Supabase Realtime push (new rows appear + toast instantly). */
export function NotificationBell({
  userId,
  role,
  initial,
}: {
  userId: string;
  role: AppRole;
  initial: Notification[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>(initial);
  const [open, setOpen] = useState(false);
  const unread = useMemo(() => items.filter((n) => n.status !== "read").length, [items]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_profile_id=eq.${userId}` },
        (payload: { new: unknown }) => {
          const n = payload.new as Notification;
          if (n.channel !== "in_app") return;
          setItems((prev) => [n, ...prev].slice(0, 30));
          toast(n.title, {
            description: n.message,
            action: n.order_id
              ? { label: "Open", onClick: () => router.push(orderHref(role, n.order_id!)) }
              : undefined,
          });
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, role, router]);

  async function markAll() {
    const ids = items.filter((n) => n.status !== "read").map((n) => n.id);
    setItems((prev) => prev.map((n) => ({ ...n, status: "read" })));
    await markNotificationsRead(ids);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}>
        <motion.span
          key={unread}
          animate={unread ? { rotate: [0, -14, 12, -8, 6, 0] } : {}}
          transition={{ duration: 0.6 }}
          className="inline-flex"
        >
          <Bell className="size-[18px]" />
        </motion.span>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="bg-destructive absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-muted-foreground text-xs">{unread} unread · live</p>
          </div>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={!unread}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">You&apos;re all caught up.</p>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {items.map((n) => (
                  <motion.li
                    key={n.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="border-b last:border-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        if (n.order_id) router.push(orderHref(role, n.order_id));
                      }}
                      className="hover:bg-muted/60 flex w-full gap-3 px-4 py-3 text-left transition-colors"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                          n.status === "read" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                        )}
                      >
                        <MessageCircle className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{n.title}</span>
                          {n.status !== "read" && <span className="bg-primary size-1.5 shrink-0 rounded-full" />}
                        </span>
                        <span className="text-muted-foreground line-clamp-2 text-xs">{n.message}</span>
                        <span className="text-muted-foreground/80 mt-1 block text-[11px]">{formatRelative(n.created_at)}</span>
                      </span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
