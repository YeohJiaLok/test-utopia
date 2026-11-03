import { Bone, LoadingLabel, PanelBones } from "@/components/manager/skeletons";

export default function ReviewWorkspaceLoading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Loading order" />
      <div className="space-y-3" aria-hidden>
        <Bone className="h-3 w-24" />
        <div className="flex items-center gap-2">
          <Bone className="h-7 w-48" />
          <Bone className="h-6 w-20 rounded-full" />
        </div>
        <Bone className="h-4 w-72 max-w-full" />
        <div className="bg-card grid grid-cols-6 gap-2 rounded-xl border px-4 py-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Bone className="size-7 rounded-full" />
              <Bone className="hidden h-2.5 w-12 sm:block" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <PanelBones rows={2} />
          <PanelBones rows={4} />
          <div className="bg-card grid grid-cols-3 gap-2 rounded-xl border p-4 sm:grid-cols-6" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <Bone key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>
        <div className="bg-card space-y-4 rounded-xl border p-4" aria-hidden>
          <Bone className="h-4 w-32" />
          <div className="flex gap-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Bone key={i} className="size-7 rounded-md" />
            ))}
          </div>
          <Bone className="h-24 w-full rounded-lg" />
          <Bone className="h-10 w-full rounded-lg" />
          <Bone className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
