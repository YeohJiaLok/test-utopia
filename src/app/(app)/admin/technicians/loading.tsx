import { HeaderSkeleton, LoadingAnnouncement, Shimmer } from "@/components/admin/skeletons";

export default function TechniciansLoading() {
  return (
    <div className="space-y-6">
      <LoadingAnnouncement label="Loading technicians" />
      <HeaderSkeleton actions={0} />
      <Shimmer className="h-20 rounded-xl" />
      {[3, 2].map((count, g) => (
        <div key={g} className="space-y-3" aria-hidden>
          <Shimmer className="h-5 w-40" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="bg-card space-y-4 rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <Shimmer className="size-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Shimmer className="h-4 w-32" />
                    <Shimmer className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex gap-1">
                  <Shimmer className="h-5 w-16 rounded-full" />
                  <Shimmer className="h-5 w-20 rounded-full" />
                </div>
                <Shimmer className="h-1.5" />
                <div className="grid grid-cols-3 gap-2 border-t pt-3">
                  <Shimmer className="h-8" />
                  <Shimmer className="h-8" />
                  <Shimmer className="h-8" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
