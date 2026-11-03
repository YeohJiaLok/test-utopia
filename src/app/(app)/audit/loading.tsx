import { Bone, HeaderBones, LoadingLabel } from "@/components/manager/skeletons";

export default function AuditLoading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Loading audit log" />
      <HeaderBones actions={0} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} className="h-14 rounded-lg" />
        ))}
      </div>
      <Bone className="h-8 w-72 rounded-lg" />
      <div className="bg-card divide-y rounded-xl border" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3">
            <Bone className="h-3 w-16" />
            <Bone className="h-3 w-28" />
            <Bone className="h-3 w-32" />
            <Bone className="hidden h-3 w-24 sm:block" />
            <Bone className="ml-auto hidden h-5 w-40 rounded-full md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
