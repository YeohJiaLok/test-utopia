import { Bone, HeaderBones, LoadingLabel, PanelBones, StatBones } from "@/components/manager/skeletons";

export default function ManagerDashboardLoading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Loading performance dashboard" />
      <HeaderBones />
      <div className="flex items-center justify-between gap-3" aria-hidden>
        <Bone className="h-11 w-full rounded-lg sm:h-9 sm:w-96" />
        <Bone className="hidden h-3 w-56 sm:block" />
      </div>
      <StatBones />
      <PanelBones rows={6} />
      <div className="grid gap-4 lg:grid-cols-3">
        <PanelBones chart className="lg:col-span-2" />
        <PanelBones rows={5} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <PanelBones chart className="lg:col-span-2" />
        <PanelBones rows={3} />
      </div>
    </div>
  );
}
