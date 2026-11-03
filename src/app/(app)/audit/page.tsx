import type { Metadata } from "next";
import { Lock, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { FadeIn } from "@/components/motion";
import { AuditNavProvider, PendingFade } from "@/components/audit/audit-nav";
import { AuditToolbar } from "@/components/audit/audit-toolbar";
import { AuditKpis } from "@/components/audit/audit-summary";
import { AuditFeed } from "@/components/audit/audit-feed";
import { parseAuditFilters } from "./_lib/filters";
import { getAuditPage } from "./_lib/queries";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(["admin", "manager"]);
  const filters = parseAuditFilters(await searchParams);
  const data = await getAuditPage(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        description="A permanent record of every workflow transition, every AI model call and every account change: who did what, when, and what changed."
        actions={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-primary/8 text-primary ring-primary/15 inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-medium ring-1 ring-inset">
              <Lock className="size-3.5" /> Append-only
            </span>
            <span className="bg-muted text-muted-foreground inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-medium">
              <ShieldCheck className="size-3.5" /> Row-level secured
            </span>
          </div>
        }
      />

      <AuditNavProvider>
        <FadeIn>
          <AuditToolbar filters={data.filters} rangeLabel={data.range.label} />
        </FadeIn>
        <PendingFade className="space-y-5">
          <AuditKpis key={`${data.tab}-kpis`} kpis={data.kpis} rangeLabel={data.range.label} capped={data.capped} />
          <AuditFeed data={data} viewerRole={user.role} />
        </PendingFade>
      </AuditNavProvider>
    </div>
  );
}
