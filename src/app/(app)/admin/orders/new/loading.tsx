import { HeaderSkeleton, LoadingAnnouncement, Shimmer } from "@/components/admin/skeletons";

export default function NewOrderLoading() {
  return (
    <div className="space-y-6">
      <LoadingAnnouncement label="Loading order form" />
      <HeaderSkeleton actions={0} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-hidden>
        <div className="space-y-5">
          <Shimmer className="h-20 rounded-xl" />
          {[4, 3, 3].map((fields, s) => (
            <div key={s} className="bg-card rounded-xl border">
              <div className="flex items-center gap-3 border-b px-5 py-3">
                <Shimmer className="size-8 rounded-lg" />
                <div className="space-y-1.5">
                  <Shimmer className="h-3.5 w-24" />
                  <Shimmer className="h-3 w-48" />
                </div>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                {Array.from({ length: fields }, (_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Shimmer className="h-3 w-24" />
                    <Shimmer className="h-9" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Shimmer className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
