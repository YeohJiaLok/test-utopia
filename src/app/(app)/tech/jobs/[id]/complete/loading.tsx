import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading form">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-1.5 rounded-full" />
        ))}
      </div>
      <div className="flex items-start gap-3 pt-2">
        <Skeleton className="size-11 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-11 w-28 rounded-full" />
        ))}
      </div>
    </div>
  );
}
