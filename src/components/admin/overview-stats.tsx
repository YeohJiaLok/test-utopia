"use client";

import { AlarmClock, CalendarCheck2, ClipboardCheck, Wallet, Wrench } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";

export interface OverviewStatsData {
  todayTotal: number;
  todayDone: number;
  onSite: number;
  late: number;
  awaitingReview: number;
  revenueToday: number;
  completedToday: number;
}

export function OverviewStats({ stats }: { stats: OverviewStatsData }) {
  const toGo = Math.max(0, stats.todayTotal - stats.todayDone);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatCard
        index={0}
        label="Today's jobs"
        value={stats.todayTotal}
        icon={<CalendarCheck2 />}
        hint={stats.todayTotal ? `${stats.todayDone} done · ${toGo} to go` : "Nothing scheduled today"}
      />
      <StatCard index={1} label="On site now" value={stats.onSite} icon={<Wrench />} hint="Technicians working" />
      <StatCard
        index={2}
        label="Running late"
        value={stats.late}
        icon={<AlarmClock />}
        hint={stats.late ? "Slot passed, not started" : "Everyone on time"}
      />
      <StatCard
        index={3}
        label="Awaiting review"
        value={stats.awaitingReview}
        icon={<ClipboardCheck />}
        hint="Job Done, manager to approve"
      />
      <StatCard
        index={4}
        label="Revenue today"
        value={stats.revenueToday}
        kind="currency"
        icon={<Wallet />}
        hint={`${stats.completedToday} job${stats.completedToday === 1 ? "" : "s"} completed`}
        className="col-span-2 md:col-span-1"
      />
    </div>
  );
}
