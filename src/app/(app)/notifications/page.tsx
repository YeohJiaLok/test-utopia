import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { MarkAllRead, NotificationCenter } from "@/components/shell/notification-center";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 30;

/**
 * Every in-app notification of the signed-in user, not just the latest few in the bell,
 * with an unread filter and paging, so nothing that needs action is lost when new ones arrive.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const unreadOnly = sp.filter === "unread";
  const page = Math.max(1, Math.min(200, Number.parseInt(String(sp.page ?? "1"), 10) || 1));
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let q = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("recipient_profile_id", user.id)
    .eq("channel", "in_app")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (unreadOnly) q = q.neq("status", "read");
  const [{ data, count }, unread] = await Promise.all([
    q,
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_profile_id", user.id)
      .eq("channel", "in_app")
      .neq("status", "read"),
  ]);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (patch: { filter?: string; page?: number }) => {
    const p = new URLSearchParams();
    const f = patch.filter ?? (unreadOnly ? "unread" : "");
    if (f) p.set("filter", f);
    const pg = patch.page ?? 1;
    if (pg > 1) p.set("page", String(pg));
    const s = p.toString();
    return s ? `/notifications?${s}` : "/notifications";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader eyebrow="Inbox" title="Notifications" description="Every alert sent to you, newest first. Open one to go straight to the order." />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="bg-muted/60 flex gap-1 rounded-xl p-1" aria-label="Filter">
          {[
            { key: "", label: "All", n: undefined },
            { key: "unread", label: "Unread", n: unread.count ?? 0 },
          ].map((t) => {
            const on = (t.key === "unread") === unreadOnly;
            return (
              <Link
                key={t.label}
                href={href({ filter: t.key, page: 1 })}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
                  on ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {t.n !== undefined && <span className="bg-primary/12 text-primary rounded-full px-1.5 text-[11px] font-semibold">{t.n}</span>}
              </Link>
            );
          })}
        </nav>
        <MarkAllRead disabled={!unread.count} />
      </div>

      <NotificationCenter items={(data ?? []) as Notification[]} role={user.role} unreadOnly={unreadOnly} />

      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>
          {total.toLocaleString("en-MY")} notification{total === 1 ? "" : "s"}
        </span>
        {pages > 1 && (
          <div className="flex items-center gap-1">
            <Link
              href={href({ page: page - 1 })}
              aria-disabled={page <= 1}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 sm:h-8", page <= 1 && "pointer-events-none opacity-50")}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Link>
            <span className="tabular-nums">
              Page {page} of {pages}
            </span>
            <Link
              href={href({ page: page + 1 })}
              aria-disabled={page >= pages}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 sm:h-8", page >= pages && "pointer-events-none opacity-50")}
              aria-label="Next page"
            >
              <ChevronRight />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
