import Link from "next/link";
import { FilePlus2, LayoutGrid } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getTechniciansWithLoad } from "@/lib/data/reference";
import { formatDate } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { OverviewStats } from "@/components/admin/overview-stats";
import { DispatchQueue } from "@/components/admin/dispatch-queue";
import { TechnicianStrip } from "@/components/admin/technician-strip";
import { StatusDistribution } from "@/components/admin/status-distribution";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { cn } from "@/lib/utils";
import { getOverview } from "./_lib/queries";

export const metadata = { title: "Overview · Sejuk Ops" };

export default async function AdminOverviewPage() {
  const user = await requireUser(["admin"]);
  const [overview, technicians] = await Promise.all([getOverview(), getTechniciansWithLoad()]);
  const firstName = user.fullName.split(/\s+/)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Dispatch · ${formatDate(new Date())}`}
        title="Operations overview"
        description={`Welcome back, ${firstName}. Today's intake, the dispatch queue and live technician load in one place.`}
        actions={
          <>
            <Link href="/admin/orders?view=board" className={cn(buttonVariants({ variant: "outline" }), "h-11 flex-1 sm:h-9 sm:flex-none")}>
              <LayoutGrid /> Board
            </Link>
            <Link href="/admin/orders/new" className={cn(buttonVariants(), "shadow-brand/25 h-11 flex-1 shadow-md sm:h-9 sm:flex-none")}>
              <FilePlus2 /> New order
            </Link>
          </>
        }
      />

      <OverviewStats stats={overview.stats} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <DispatchQueue orders={overview.queue} technicians={technicians} total={overview.stats.unassigned} />
          <TechnicianStrip technicians={technicians} onSiteIds={overview.onSiteTechIds} />
        </div>
        {/* Side rail: two-up on tablets/laptops, stacked beside the main column on wide screens */}
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2 xl:grid-cols-1">
          <StatusDistribution counts={overview.statusCounts} />
          <ActivityFeed items={overview.activity} />
        </div>
      </div>
    </div>
  );
}
