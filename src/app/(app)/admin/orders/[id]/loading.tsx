import { LoadingAnnouncement, PanelSkeleton, Shimmer } from "@/components/admin/skeletons";

export default function OrderDetailLoading() {
  return (
    <div className="space-y-6">
      <LoadingAnnouncement label="Loading order" />
      <div className="space-y-4" aria-hidden>
        <Shimmer className="h-4 w-24" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Shimmer className="h-8 w-48" />
              <Shimmer className="h-6 w-20 rounded-full" />
            </div>
            <Shimmer className="h-4 w-72 max-w-full" />
            <Shimmer className="h-3 w-56" />
          </div>
          <div className="flex gap-2">
            <Shimmer className="h-8 w-28" />
            <Shimmer className="h-8 w-36" />
          </div>
        </div>
      </div>
      <div className="bg-card rounded-xl border p-4 sm:px-6" aria-hidden>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Shimmer className="size-7 rounded-full" />
              <Shimmer className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6" aria-hidden>
          <div className="bg-card space-y-4 rounded-xl border p-4">
            <Shimmer className="h-4 w-20" />
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Shimmer className="h-3 w-16" />
                  <Shimmer className="h-4 w-28" />
                </div>
              ))}
            </div>
            <Shimmer className="h-12" />
          </div>
          <Shimmer className="h-56 rounded-xl" />
          <PanelSkeleton rows={4} />
        </div>
        <div className="space-y-6" aria-hidden>
          <Shimmer className="h-48 rounded-xl" />
          <Shimmer className="h-36 rounded-xl" />
          <PanelSkeleton rows={2} />
        </div>
      </div>
    </div>
  );
}
