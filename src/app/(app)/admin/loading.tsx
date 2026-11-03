import { HeaderSkeleton, LoadingAnnouncement, PanelSkeleton, Shimmer } from "@/components/admin/skeletons";

export default function AdminOverviewLoading() {
  return (
    <div className="space-y-6">
      <LoadingAnnouncement label="Loading overview" />
      <HeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="bg-card space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <Shimmer className="h-3 w-24" />
              <Shimmer className="size-8 rounded-lg" />
            </div>
            <Shimmer className="h-7 w-20" />
            <Shimmer className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <PanelSkeleton rows={3} />
          <div className="bg-card rounded-xl border" aria-hidden>
            <div className="space-y-1.5 border-b px-4 py-3">
              <Shimmer className="h-4 w-44" />
              <Shimmer className="h-3 w-56" />
            </div>
            <div className="space-y-3 px-4 pt-3.5">
              <Shimmer className="h-2 w-full rounded-full" />
            </div>
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Shimmer key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2 xl:grid-cols-1">
          <PanelSkeleton rows={4} />
          <PanelSkeleton rows={5} />
        </div>
      </div>
    </div>
  );
}
