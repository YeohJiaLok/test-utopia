import type { Metadata } from "next";
import { Activity, AlertOctagon, Bot, Coins, Timer } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/motion";
import { AuditLog } from "@/components/manager/audit-log";
import { getAuditData } from "./_lib/queries";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  const user = await requireUser(["admin", "manager"]);
  const { events, runs, userEvents, week } = await getAuditData();

  const chips = [
    { icon: Bot, label: "AI runs this week", value: formatNumber(week.runs) },
    { icon: Timer, label: "Avg latency", value: week.avgLatencyMs !== null ? `${(week.avgLatencyMs / 1000).toFixed(1)} s` : "—" },
    {
      icon: Coins,
      label: "Tokens this week",
      value: week.tokens >= 10_000 ? `${(week.tokens / 1000).toFixed(1)}K` : formatNumber(week.tokens),
    },
    { icon: AlertOctagon, label: "Errors / refusals", value: formatNumber(week.errors) },
    { icon: Activity, label: "Order events shown", value: formatNumber(events.length) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        description="Every workflow transition is written by the database to an append-only ledger, every AI model call is logged with its tool use, tokens and latency, and every account change is recorded with who made it."
      />

      <Stagger className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {chips.map((c) => (
          <StaggerItem key={c.label} className="bg-card flex items-center gap-3 rounded-lg border px-3 py-2.5">
            <span className="bg-primary/8 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
              <c.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-muted-foreground truncate text-[11px]">{c.label}</p>
              <p className="tabular text-sm font-semibold">{c.value}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <AuditLog events={events} runs={runs} userEvents={userEvents} viewerRole={user.role} />
    </div>
  );
}
