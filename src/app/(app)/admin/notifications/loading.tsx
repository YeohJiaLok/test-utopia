import { HeaderSkeleton, LoadingAnnouncement, Shimmer } from "@/components/admin/skeletons";

export default function OutboxLoading() {
  return (
    <div className="space-y-6">
      <LoadingAnnouncement label="Loading WhatsApp outbox" />
      <HeaderSkeleton actions={0} />
      <div className="flex justify-between gap-3" aria-hidden>
        <div className="flex gap-1">
          {Array.from({ length: 3 }, (_, i) => (
            <Shimmer key={i} className="h-8 w-24" />
          ))}
        </div>
        <div className="hidden gap-1.5 md:flex">
          <Shimmer className="h-7 w-24 rounded-full" />
          <Shimmer className="h-7 w-24 rounded-full" />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-card space-y-2.5 rounded-xl border p-4">
            <div className="flex gap-2">
              <Shimmer className="h-5 w-20" />
              <Shimmer className="h-5 w-32" />
              <Shimmer className="ml-auto h-5 w-16 rounded-full" />
            </div>
            <Shimmer className="h-3 w-40" />
            <Shimmer className="h-20" />
            <Shimmer className="h-7 w-36" />
          </div>
        ))}
      </div>
    </div>
  );
}
