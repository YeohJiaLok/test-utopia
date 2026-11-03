import type { Metadata } from "next";
import { Lock, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { IntegrityBadge, type ChainStatus } from "@/components/audit/integrity-badge";
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
  const [data, chain] = await Promise.all([getAuditPage(filters), verifyChain()]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        description="A permanent record of every workflow transition, every AI model call and every account change: who did what, when, and what changed."
        actions={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <IntegrityBadge status={chain} />
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

/** Recomputes the order-event hash chain in the database (see *_audit_integrity.sql). */
async function verifyChain(): Promise<ChainStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_audit_chain");
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (error || !row) return null;
  return {
    ok: Boolean(row.ok),
    checked: Number(row.checked),
    brokenSeq: row.broken_seq == null ? null : Number(row.broken_seq),
    reason: (row.reason as string | null) ?? null,
    headHash: (row.head_hash as string | null) ?? null,
    verifiedAt: row.verified_at as string,
  };
}
