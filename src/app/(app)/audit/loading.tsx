import { Bone, HeaderBones, LoadingLabel } from "@/components/manager/skeletons";

export default function AuditLoading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Loading audit log" />
      <HeaderBones actions={2} />
      <div className="space-y-3" aria-hidden>
        <Bone className="h-11 w-full rounded-xl sm:w-[26rem]" />
        <div className="flex gap-2">
          <Bone className="h-10 flex-1 rounded-lg lg:max-w-sm lg:flex-none lg:basis-96" />
          <Bone className="h-10 w-10 rounded-lg lg:w-44" />
          <Bone className="hidden h-10 w-44 rounded-lg lg:block" />
          <Bone className="h-10 w-10 rounded-lg lg:ml-auto lg:w-32" />
        </div>
        <div className="flex gap-1.5 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <Bone key={i} className="h-8 w-20 shrink-0 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-card space-y-2.5 rounded-xl border p-3 sm:p-4">
            <Bone className="h-3 w-20" />
            <Bone className="h-6 w-16" />
            <Bone className="h-2.5 w-24" />
          </div>
        ))}
      </div>
      <div className="bg-card rounded-xl border" aria-hidden>
        <div className="flex h-[4.75rem] items-end gap-[2px] border-b px-4 pb-3">
          {Array.from({ length: 30 }, (_, i) => (
            <Bone key={i} className="flex-1 rounded-t-[3px] rounded-b-none" style={{ height: `${20 + ((i * 37) % 70)}%` }} />
          ))}
        </div>
        <div className="bg-muted/30 border-b px-4 py-2">
          <Bone className="h-3 w-24" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Bone className="size-8 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2 md:flex md:items-center md:gap-6 md:space-y-0">
                <Bone className="h-3 w-32" />
                <Bone className="h-3 w-40" />
                <Bone className="hidden h-3 w-24 md:block" />
                <Bone className="hidden h-5 w-44 rounded-full md:ml-auto md:block" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
