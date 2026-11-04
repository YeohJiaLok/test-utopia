import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, Clock, ClipboardCheck, Play, ShieldAlert, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatMYR, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Stagger, StaggerItem } from "@/components/motion";
import { ReviewQueue } from "@/components/manager/review-queue";
import { ReviewTabs } from "@/components/manager/reviews/review-tabs";
import { ReadyToClose } from "@/components/manager/reviews/ready-to-close";
import { SentBack } from "@/components/manager/reviews/sent-back";
import { DecisionHistory } from "@/components/manager/reviews/decision-history";
import { getReviewQueue } from "../_lib/queries";
import {
  REVIEW_TABS,
  getDecisionHistory,
  getReadyToClose,
  getSentBack,
  getTabCounts,
  parseHistoryFilters,
  type ReviewTab,
} from "./_lib/workspace";

export const metadata: Metadata = { title: "Reviews" };

const HEADER: Record<ReviewTab, { title: string; description: string }> = {
  awaiting: {
    title: "Review queue",
    description: "Completed jobs awaiting manager sign-off. Check the evidence, rate the work, then approve or send it back for rework.",
  },
  close: {
    title: "Ready to close",
    description: "Approved jobs waiting to be finalised. Check payment is collected, then close them one by one or in bulk.",
  },
  "sent-back": {
    title: "Sent back for rework",
    description: "Jobs you returned to the technician. They come back to the review queue when the technician resubmits.",
  },
  history: {
    title: "Decision history",
    description: "Every approval, rework request and close, with rating, notes and who decided, from the tamper-evident audit trail.",
  },
};

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(["manager", "admin"]);
  const sp = await searchParams;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab: ReviewTab = (REVIEW_TABS as string[]).includes(tabParam ?? "") ? (tabParam as ReviewTab) : "awaiting";
  const counts = await getTabCounts();
  const header = HEADER[tab];

  if (tab !== "awaiting") {
    const filters = parseHistoryFilters(sp);
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Quality control" title={header.title} description={header.description} />
        <ReviewTabs active={tab} counts={counts} />
        {tab === "close" && <ReadyToClose items={await getReadyToClose()} />}
        {tab === "sent-back" && <SentBack items={await getSentBack()} />}
        {tab === "history" && <DecisionHistory filters={filters} {...await getDecisionHistory(filters, user.id)} />}
      </div>
    );
  }

  const { items, asOf } = await getReviewQueue();

  const value = items.reduce((s, i) => s + i.final, 0);
  const flagged = items.filter((i) => i.openFlags > 0).length;
  const extras = items.filter((i) => i.extra > 0).length;
  const oldest = items[0]?.completedAt ?? null;

  const chips: { label: string; value: string; icon: React.ReactNode; tone?: string; iconTone?: string }[] = [
    { label: "Awaiting review", value: formatNumber(items.length), icon: <ClipboardCheck /> },
    { label: "Value awaiting sign-off", value: formatMYR(value), icon: <Banknote /> },
    {
      label: "With open AI flags",
      value: formatNumber(flagged),
      icon: <ShieldAlert />,
      tone: flagged ? "text-amber-700 dark:text-amber-300" : undefined,
      iconTone: flagged ? "bg-amber-500/12 text-amber-600 dark:text-amber-300" : undefined,
    },
    { label: "Charged above quote", value: formatNumber(extras), icon: <TrendingUp /> },
    { label: "Oldest completion", value: oldest ? formatRelative(oldest) : "—", icon: <Clock /> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Quality control"
        title={header.title}
        description={header.description}
        actions={
          items[0] ? (
            <Link
              href={`/manager/orders/${items[0].id}`}
              className={buttonVariants({ className: "shadow-brand/25 shadow-sm max-sm:h-11 max-sm:w-full" })}
            >
              <Play /> Start with oldest
            </Link>
          ) : undefined
        }
      />

      <ReviewTabs active={tab} counts={counts} />

      <Stagger className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 [&>*]:min-w-0">
        {chips.map((c, i) => (
          <StaggerItem
            key={c.label}
            className={cn(
              "bg-card flex items-center gap-3 rounded-xl border px-3 py-3 shadow-xs",
              i === chips.length - 1 && "max-sm:col-span-2",
            )}
          >
            <span
              aria-hidden
              className={cn("bg-primary/8 text-primary flex size-8 shrink-0 sm:size-9 items-center justify-center rounded-lg [&_svg]:size-4", c.iconTone)}
            >
              {c.icon}
            </span>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] leading-tight font-medium sm:truncate">{c.label}</p>
              <p className={cn("tabular mt-0.5 truncate text-base font-semibold tracking-tight", c.tone)}>{c.value}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <ReviewQueue items={items} now={asOf} />
    </div>
  );
}
