import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading history">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-44 rounded-2xl lg:h-28" />
      <Skeleton className="h-36 rounded-2xl lg:h-16" />
      {[0, 1].map((g) => (
        <div key={g} className="space-y-2">
          <div className="flex justify-between px-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="bg-card divide-y rounded-2xl border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
