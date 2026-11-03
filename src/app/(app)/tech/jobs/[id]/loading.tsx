import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading job">
      <Skeleton className="h-6 w-24" />
      <div className="bg-card space-y-3 rounded-2xl border p-4">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-4 h-8 w-full" />
      </div>
      <div className="bg-card space-y-3 rounded-2xl border p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <div className="grid grid-cols-2 gap-2 pt-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="bg-card space-y-3 rounded-2xl border p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
