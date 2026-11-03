import { Bone, HeaderBones, LoadingLabel } from "@/components/manager/skeletons";

export default function ReviewQueueLoading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Loading review queue" />
      <HeaderBones actions={1} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="bg-card space-y-1.5 rounded-lg border px-3 py-2.5">
            <Bone className="h-3 w-24" />
            <Bone className="h-4 w-16" />
          </div>
        ))}
      </div>
      <Bone className="h-9 w-72 max-w-full rounded-lg" />
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
