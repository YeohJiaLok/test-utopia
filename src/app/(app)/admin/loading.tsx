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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <PanelSkeleton rows={5} />
          <div className="bg-card rounded-xl border p-3" aria-hidden>
            <div className="flex gap-2.5 overflow-hidden">
              {Array.from({ length: 6 }, (_, i) => (
                <Shimmer key={i} className="h-24 w-40 shrink-0 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={6} />
        </div>
      </div>
    </div>
  );
}
