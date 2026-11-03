import { HeaderSkeleton, LoadingAnnouncement, Shimmer } from "@/components/admin/skeletons";

export default function AdminOrdersLoading() {
  return (
    <div className="space-y-5">
      <LoadingAnnouncement label="Loading orders" />
      <HeaderSkeleton actions={1} />
      <div className="space-y-3" aria-hidden>
        <div className="flex flex-col gap-2 lg:flex-row">
          <Shimmer className="h-9 flex-1" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Shimmer className="h-9 sm:w-48" />
            <Shimmer className="h-9 sm:w-44" />
            <Shimmer className="col-span-2 h-9 sm:w-40" />
          </div>
        </div>
        <div className="flex gap-1 overflow-hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <Shimmer key={i} className="h-8 w-24 shrink-0" />
          ))}
        </div>
      </div>
      <div className="bg-card hidden overflow-hidden rounded-xl border md:block" aria-hidden>
        <div className="bg-muted/40 flex gap-6 border-b px-4 py-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Shimmer key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex items-center gap-6 border-b px-4 py-3.5 last:border-0">
            <div className="flex-1 space-y-1.5">
              <Shimmer className="h-3.5 w-28" />
              <Shimmer className="h-3 w-16" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Shimmer className="h-3.5 w-32" />
              <Shimmer className="h-3 w-24" />
            </div>
            <Shimmer className="h-3.5 flex-1" />
            <Shimmer className="h-3.5 flex-1" />
            <Shimmer className="h-3.5 w-20" />
            <Shimmer className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
      <div className="space-y-2.5 md:hidden" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Shimmer key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
