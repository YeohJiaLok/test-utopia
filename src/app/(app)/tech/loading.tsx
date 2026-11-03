import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5 lg:space-y-6" aria-busy="true" aria-label="Loading jobs">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-56" />
        </div>
        <Skeleton className="size-11 rounded-xl" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className={i === 1 ? "hidden h-[74px] rounded-2xl sm:block lg:h-36" : "h-[74px] rounded-2xl lg:h-36"} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Skeleton className="-mx-1 h-[54px] rounded-2xl sm:mx-0 sm:max-w-md" />
          <div className="grid gap-3 md:grid-cols-2 lg:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-card space-y-3 rounded-2xl border p-4">
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden space-y-4 lg:block">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
