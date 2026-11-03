import type { Metadata } from "next";
import { Cog, ScrollText, Sparkles, UserCheck } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { FlagInbox, RescanButton } from "@/components/manager/flag-inbox";
import { getFlags } from "../_lib/queries";

export const metadata: Metadata = { title: "AI Supervisor" };

const STEPS = [
  {
    icon: Cog,
    title: "Rule engine",
    body: "Deterministic checks run on every completion — charges above quote, missing photos, payment gaps, repeated postponements.",
  },
  {
    icon: Sparkles,
    title: "AI reviewer",
    body: "Claude reads the work notes, remarks and evidence summary to catch what rules can't, with a written explanation.",
  },
  {
    icon: UserCheck,
    title: "Human decision",
    body: "Findings never change an order. A manager resolves each one with a note; the decision stays on record.",
  },
];

export default async function FlagsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser(["manager", "admin"]);
  const sp = await searchParams;
  const showResolved = sp.resolved === "1";
  const flags = await getFlags(showResolved);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI governance"
        title="AI Supervisor"
        description="Findings raised on completed jobs, sorted by severity. Open the order to see the evidence, then resolve with a note."
        actions={<RescanButton />}
      />

      <section aria-label="How the AI Supervisor works" className="bg-card rounded-xl border p-4">
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-3">
              <span className="bg-primary/8 text-primary relative flex size-8 shrink-0 items-center justify-center rounded-lg">
                <s.icon className="size-4" />
                <span className="bg-card text-muted-foreground absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border text-[9px] font-semibold">
                  {i + 1}
                </span>
              </span>
              <div>
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-muted-foreground text-xs text-pretty">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-3 flex items-center gap-1.5 border-t pt-3 text-[11px]">
          <ScrollText className="size-3.5" />
          Every model call and tool use is logged —
          <Link href="/audit" className="text-primary hover:underline">
            see the audit log
          </Link>
        </p>
      </section>

      <FlagInbox flags={flags} showResolved={showResolved} />
    </div>
  );
}
