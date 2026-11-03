import { Bone, HeaderBones, LoadingLabel } from "@/components/manager/skeletons";

export default function FlagsLoading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Loading AI Supervisor inbox" />
      <HeaderBones actions={1} />
      <Bone className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-2" aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <Bone key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Bone className="h-36 w-full rounded-xl lg:h-14" />
      <div className="grid gap-3 xl:grid-cols-2" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-card space-y-2.5 rounded-xl border p-4">
            <div className="flex gap-2">
              <Bone className="h-5 w-14" />
              <Bone className="h-5 w-24" />
            </div>
            <Bone className="h-4 w-3/5" />
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-4/5" />
            <Bone className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
