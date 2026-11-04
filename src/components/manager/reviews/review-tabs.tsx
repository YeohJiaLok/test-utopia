import Link from "next/link";
import { CheckCheck, ClipboardCheck, History, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewTab } from "@/app/(app)/manager/reviews/_lib/workspace";

const TABS: { key: ReviewTab; label: string; short: string; icon: typeof History }[] = [
  { key: "awaiting", label: "Awaiting review", short: "Awaiting", icon: ClipboardCheck },
  { key: "close", label: "Ready to close", short: "To close", icon: CheckCheck },
  { key: "sent-back", label: "Sent back", short: "Sent back", icon: RotateCcw },
  { key: "history", label: "Decision history", short: "History", icon: History },
];

/** URL-driven tabs (?tab=…), so each list has its own address and survives refresh. */
export function ReviewTabs({ active, counts }: { active: ReviewTab; counts: Partial<Record<ReviewTab, number>> }) {
  return (
    <nav aria-label="Review workspace" className="bg-muted/60 -mx-1 flex gap-1 overflow-x-auto rounded-xl p-1 sm:mx-0 [scrollbar-width:none]">
      {TABS.map(({ key, label, short, icon: Icon }) => {
        const on = key === active;
        const count = counts[key];
        return (
          <Link
            key={key}
            href={key === "awaiting" ? "/manager/reviews" : `/manager/reviews?tab=${key}`}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors sm:flex-1 sm:justify-center",
              on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
            {count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  on ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15",
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Stars({ value, className }: { value: number | null; className?: string }) {
  if (!value) return <span className={cn("text-muted-foreground text-xs", className)}>—</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} of 5 stars`} title={`${value} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={cn("size-3.5", i < value ? "fill-amber-400" : "fill-muted-foreground/25")} aria-hidden>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}
