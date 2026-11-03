"use client";

import { CheckCircle2, FilePlus2, Hourglass, Wallet, Wrench } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";

export interface OverviewStatsData {
  newToday: number;
  unassigned: number;
  inProgress: number;
  completedToday: number;
  revenueToday: number;
}

export function OverviewStats({ stats }: { stats: OverviewStatsData }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatCard index={0} label="New orders today" value={stats.newToday} icon={<FilePlus2 />} hint="Created since midnight" />
      <StatCard
        index={1}
        label="Awaiting assignment"
        value={stats.unassigned}
        icon={<Hourglass />}
        hint={stats.unassigned ? "Dispatch below" : "Queue is clear"}
      />
      <StatCard index={2} label="On site now" value={stats.inProgress} icon={<Wrench />} hint="Jobs in progress" />
      <StatCard index={3} label="Completed today" value={stats.completedToday} icon={<CheckCircle2 />} hint="Job Done or later" />
      <StatCard
        index={4}
        label="Revenue today"
        value={stats.revenueToday}
        kind="currency"
        icon={<Wallet />}
        hint="Final amounts collected"
        className="col-span-2 md:col-span-1"
      />
    </div>
  );
}
