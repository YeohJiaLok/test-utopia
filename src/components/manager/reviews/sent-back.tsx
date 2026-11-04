import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { SentBackItem } from "@/app/(app)/manager/reviews/_lib/workspace";

/** Jobs a manager returned for rework: still with the technician, oldest request first. */
export function SentBack({ items }: { items: SentBackItem[] }) {
  if (!items.length) {
    return (
      <EmptyState
        icon={RotateCcw}
        className="bg-card py-16"
        title="No jobs out for rework"
        description="Jobs you send back appear here until the technician resubmits them for review."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id} className="bg-card rounded-xl border p-3.5 shadow-xs">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/manager/orders/${i.id}`} className="text-primary font-mono text-[13px] font-semibold hover:underline">
              {i.orderNo}
            </Link>
            <span className="truncate text-sm font-medium">{i.customer}</span>
            <StatusBadge status="in_progress" />
            <span className="text-muted-foreground ml-auto text-xs" title={formatDateTime(i.sentAt)} suppressHydrationWarning>
              Sent back {formatRelative(i.sentAt)} by {i.sentBy}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {i.service} · with {i.technician}
          </p>
          {i.notes && (
            <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/[0.05] px-3 py-2 text-sm">
              <span className="font-medium text-red-700 dark:text-red-300">To fix: </span>
              {i.notes}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
