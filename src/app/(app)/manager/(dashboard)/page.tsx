import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ClipboardCheck, Receipt, ShieldAlert, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { RANGE_LABELS } from "@/lib/time";
import { formatDate, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { AiBriefingCard } from "@/components/ai/ai-briefing-card";
import { ChartCard } from "@/components/manager/chart-card";
import { PendingFrame, RangeProvider, RangeSwitcher } from "@/components/manager/range-switcher";
import { TechnicianLeaderboard } from "@/components/manager/technician-leaderboard";
import { ThroughputChart } from "@/components/manager/charts/throughput-chart";
import { ServiceMixChart } from "@/components/manager/charts/service-mix-chart";
import { BranchChart } from "@/components/manager/charts/branch-chart";
import { WorkloadChart } from "@/components/manager/charts/workload-chart";
import { WorkloadPanel } from "@/components/manager/workload-panel";
import { DASHBOARD_RANGES, getDashboardData, isDashboardRange } from "../_lib/queries";

export const metadata: Metadata = { title: "Performance dashboard" };

const RANGE_OPTIONS = DASHBOARD_RANGES.map((k) => ({ value: k, label: RANGE_LABELS[k] }));

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(["manager", "admin"]);
  const sp = await searchParams;
  const key = isDashboardRange(sp.range) ? sp.range : "this_week";
  const data = await getDashboardData(key);
  const { stats, range } = data;
  const lastDay = new Date(new Date(range.to).getTime() - 1);

  return (
    <RangeProvider value={key}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Performance"
          title="Operations dashboard"
          description="Throughput, revenue and technician performance across every branch — live from the workflow ledger."
          actions={
            user.role === "manager" ? (
              <>
                <Link href="/manager/flags" className={buttonVariants({ variant: "outline" })}>
                  <ShieldAlert /> AI Supervisor
                </Link>
                <Link href="/manager/reviews" className={buttonVariants()}>
                  <ClipboardCheck /> Review queue
                  {stats.pendingReviews.value > 0 && (
                    <span className="bg-primary-foreground/20 tabular rounded px-1 text-[11px]">{stats.pendingReviews.value}</span>
                  )}
                </Link>
              </>
            ) : undefined
          }
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <RangeSwitcher options={RANGE_OPTIONS} />
          <p className="text-muted-foreground text-xs">
            {formatDate(range.from)} – {formatDate(lastDay)} · deltas {range.compareLabel}
          </p>
        </div>

        <PendingFrame className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard index={0} label="Jobs completed" value={stats.jobs.value} icon={<CheckCircle2 />} delta={stats.jobs.delta} hint={range.compareLabel} />
            <StatCard
              index={1}
              label="Revenue"
              value={stats.revenue.value}
              kind="currency"
              icon={<Wallet />}
              delta={stats.revenue.delta}
              hint={range.compareLabel}
            />
            <StatCard
              index={2}
              label="Avg ticket"
              value={stats.avgTicket.value}
              kind="currency"
              icon={<Receipt />}
              delta={stats.avgTicket.delta}
              hint={range.compareLabel}
            />
            <StatCard
              index={3}
              label="Postponed / rescheduled"
              value={stats.reschedules.value}
              icon={<CalendarClock />}
              invertDelta
              delta={stats.reschedules.previous > 0 ? ((stats.reschedules.value - stats.reschedules.previous) / stats.reschedules.previous) * 100 : null}
              hint={`${stats.reschedules.previous} ${range.compareLabel.replace(/^vs /, "in ")}`}
            />
            <StatCard
              index={4}
              label="Pending reviews"
              value={stats.pendingReviews.value}
              icon={<ClipboardCheck />}
              hint={stats.pendingReviews.oldestCompletedAt ? `Oldest ${formatRelative(stats.pendingReviews.oldestCompletedAt)}` : "Queue is clear"}
            />
            <StatCard
              index={5}
              label="Open AI flags"
              value={stats.openFlags.value}
              icon={<ShieldAlert />}
              hint={stats.openFlags.high ? `${stats.openFlags.high} high severity` : "None high severity"}
            />
          </div>

          <AiBriefingCard />

          <TechnicianLeaderboard rows={data.technicians} periodLabel={range.label} />

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              title="Daily throughput"
              description={`Completed jobs and revenue per ${data.granularity === "day" ? "day" : "week"} · ${range.label.toLowerCase()}`}
            >
              <ThroughputChart data={data.daily} granularity={data.granularity} />
            </ChartCard>
            <ChartCard title="Service mix" description="Share of completed work by service type">
              <ServiceMixChart data={data.serviceMix} />
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              title="Technician load vs team mean"
              description="Jobs completed per technician; bars 1.5σ above the mean are flagged as overloaded"
            >
              <WorkloadChart data={data.workload} />
            </ChartCard>
            <ChartCard title="Workload balance" description="Outliers from the team distribution this period">
              <WorkloadPanel data={data.workload} />
            </ChartCard>
          </div>

          <ChartCard title="Branch comparison" description="Completed jobs and revenue this period; open jobs are a live count">
            <BranchChart data={data.branches} />
          </ChartCard>
        </PendingFrame>
      </div>
    </RangeProvider>
  );
}
