import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Skeleton block with the brand shimmer sweep on top of the pulse. */
export function Shimmer({ className }: { className?: string }) {
  return <Skeleton className={cn("shimmer", className)} />;
}

export function HeaderSkeleton({ actions = 2 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" aria-hidden>
      <div className="space-y-2">
        <Shimmer className="h-3 w-28" />
        <Shimmer className="h-7 w-64" />
        <Shimmer className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }, (_, i) => (
          <Shimmer key={i} className="h-9 w-28" />
        ))}
      </div>
    </div>
  );
}

export function PanelSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("bg-card rounded-xl border", className)} aria-hidden>
      <div className="space-y-1.5 border-b px-4 py-3">
        <Shimmer className="h-4 w-36" />
        <Shimmer className="h-3 w-52" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Shimmer className="size-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Shimmer className="h-3.5 w-2/5" />
              <Shimmer className="h-3 w-3/5" />
            </div>
            <Shimmer className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadingAnnouncement({ label }: { label: string }) {
  return (
    <span className="sr-only" role="status">
      {label}
    </span>
  );
}
