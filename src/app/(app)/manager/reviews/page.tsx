import type { Metadata } from "next";
import Link from "next/link";
import { Play } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatMYR, formatNumber, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Stagger, StaggerItem } from "@/components/motion";
import { ReviewQueue } from "@/components/manager/review-queue";
import { getReviewQueue } from "../_lib/queries";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewQueuePage() {
  await requireUser(["manager", "admin"]);
  const { items, asOf } = await getReviewQueue();

  const value = items.reduce((s, i) => s + i.final, 0);
  const flagged = items.filter((i) => i.openFlags > 0).length;
  const extras = items.filter((i) => i.extra > 0).length;
  const oldest = items[0]?.completedAt ?? null;

  const chips = [
    { label: "Awaiting review", value: formatNumber(items.length) },
    { label: "Value awaiting sign-off", value: formatMYR(value) },
    { label: "With open AI flags", value: formatNumber(flagged), tone: flagged ? "text-amber-700 dark:text-amber-300" : undefined },
    { label: "Charged above quote", value: formatNumber(extras) },
    { label: "Oldest completion", value: oldest ? formatRelative(oldest) : "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quality control"
        title="Review queue"
        description="Completed jobs awaiting manager sign-off. Check the evidence, rate the work, then approve or send it back for rework."
        actions={
          items[0] ? (
            <Link href={`/manager/orders/${items[0].id}`} className={buttonVariants()}>
              <Play /> Start with oldest
            </Link>
          ) : undefined
        }
      />

      <Stagger className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {chips.map((c) => (
          <StaggerItem key={c.label} className="bg-card rounded-lg border px-3 py-2.5">
            <p className="text-muted-foreground text-[11px]">{c.label}</p>
            <p className={`tabular mt-0.5 truncate text-sm font-semibold ${c.tone ?? ""}`}>{c.value}</p>
          </StaggerItem>
        ))}
      </Stagger>

      <ReviewQueue items={items} now={asOf} />
    </div>
  );
}
