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
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="AI governance"
        title="AI Supervisor"
        description="Findings raised on completed jobs, sorted by severity. Open the order to see the evidence, then resolve with a note."
        actions={<RescanButton />}
      />

      <section aria-label="How the AI Supervisor works" className="bg-card overflow-hidden rounded-xl border shadow-xs max-md:order-last">
        <ol className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex gap-3 p-4">
              <span className="bg-primary/8 text-primary ring-primary/10 relative flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset">
                <s.icon className="size-4" />
                <span className="bg-card text-muted-foreground absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border text-[9px] font-semibold">
                  {i + 1}
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed text-pretty">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground bg-muted/30 flex items-start gap-2 border-t px-4 py-2.5 text-xs">
          <ScrollText className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            Every model call and tool use is logged —{" "}
            <Link href="/audit" className="text-primary font-medium hover:underline">
              see the audit log
            </Link>
          </span>
        </p>
      </section>

      <FlagInbox flags={flags} showResolved={showResolved} />
    </div>
  );
}
