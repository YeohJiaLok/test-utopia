import { Bone, HeaderBones, LoadingLabel } from "@/components/manager/skeletons";

export default function ReviewQueueLoading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Loading review queue" />
      <HeaderBones actions={1} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="bg-card flex items-center gap-3 rounded-xl border px-3 py-3">
            <Bone className="size-9 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Bone className="h-3 w-20" />
              <Bone className="h-4 w-14" />
            </div>
          </div>
        ))}
      </div>
      <Bone className="h-16 w-full rounded-xl sm:h-14" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-card space-y-3 rounded-xl border p-4">
            <div className="flex justify-between">
              <div className="space-y-1.5">
                <Bone className="h-3 w-28" />
                <Bone className="h-4 w-36" />
              </div>
              <Bone className="h-5 w-14" />
            </div>
            <Bone className="h-3 w-40" />
            <Bone className="h-3 w-32" />
            <Bone className="h-14 w-full rounded-lg" />
            <Bone className="h-3 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}
