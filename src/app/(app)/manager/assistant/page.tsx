import type { Metadata } from "next";
import {
  CalendarClock,
  Eye,
  FileText,
  Gauge,
  Hash,
  History,
  KeyRound,
  Lock,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Users,
  Rows3,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic } from "@/lib/ai/client";
import { COPILOT_GUARDRAILS, TOOL_CATALOGUE, type CopilotToolName } from "@/lib/ai/catalogue";
import { formatRelative } from "@/lib/format";
import type { AiRun } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopilotChat } from "@/components/ai/copilot-chat";

export const metadata: Metadata = { title: "Ops Copilot" };

const TOOL_ICONS: Record<CopilotToolName, LucideIcon> = {
  get_time_context: CalendarClock,
  list_technicians: Users,
  search_jobs: Search,
  count_jobs: Hash,
  technician_performance: Trophy,
  get_order_details: FileText,
  workload_analysis: Gauge,
  list_flags: ShieldAlert,
};

const GUARDRAIL_ICONS: LucideIcon[] = [Lock, Eye, Rows3, ScrollText];

const STATUS_STYLE: Record<AiRun["status"], string> = {
  ok: "bg-success/12 text-success",
  error: "bg-destructive/10 text-destructive",
  refused: "bg-warning/15 text-warning",
  blocked: "bg-muted text-muted-foreground",
};

type RecentRun = Pick<AiRun, "id" | "input" | "status" | "created_at" | "latency_ms" | "tool_calls" | "input_tokens" | "output_tokens">;

export default async function AssistantPage() {
  await requireUser(["manager", "admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_runs")
    .select("id, input, status, created_at, latency_ms, tool_calls, input_tokens, output_tokens")
    .eq("kind", "copilot")
    .order("created_at", { ascending: false })
    .limit(5);
  const runs = (data ?? []) as RecentRun[];
  const aiReady = getAnthropic() !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI · Ops Copilot"
        title="Ask your operations anything"
        description="A governed AI agent that plans, runs whitelisted read-only queries against live data and answers with the records it used. Every step is visible and logged."
      />

      {!aiReady && (
        <div className="border-warning/30 bg-warning/[0.06] flex items-start gap-3 rounded-xl border px-4 py-3">
          <span className="bg-warning/15 text-warning flex size-8 shrink-0 items-center justify-center rounded-lg">
            <KeyRound className="size-4" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">Setup mode — no AI model connected</p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              Add <code className="bg-muted rounded px-1 font-mono text-[11px]">ANTHROPIC_API_KEY</code> to the server environment to
              enable answers. The tool catalogue, guardrails and audit trail below are already live.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="bg-card ring-foreground/10 flex h-[calc(100dvh-13rem)] min-h-[480px] flex-col overflow-hidden rounded-xl shadow-sm ring-1 sm:min-h-[560px] lg:h-[calc(100dvh-15rem)]">
          <CopilotChat variant="page" className="flex-1" />
        </div>

        <aside className="grid content-start gap-4 md:grid-cols-2 lg:grid-cols-1">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Search className="text-primary size-4" /> What I can answer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {TOOL_CATALOGUE.map((tool) => {
                  const Icon = TOOL_ICONS[tool.name];
                  return (
                    <li key={tool.name} className="flex gap-2.5">
                      <span className="bg-primary/8 text-primary mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md">
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs font-medium">
                          {tool.label}
                          <code className="text-muted-foreground font-mono text-[10px] font-normal break-all">{tool.name}</code>
                        </p>
                        <p className="text-muted-foreground text-xs leading-snug">{tool.summary}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="text-success size-4" /> Guardrails
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {COPILOT_GUARDRAILS.map((g, i) => {
                  const Icon = GUARDRAIL_ICONS[i] ?? ShieldCheck;
                  return (
                    <li key={g.title} className="flex gap-2.5">
                      <Icon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium">{g.title}</p>
                        <p className="text-muted-foreground text-xs leading-snug">{g.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card size="sm" className="md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="text-muted-foreground size-4" /> Recent copilot runs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="text-muted-foreground text-xs">No runs yet. Ask a question to create the first audited run.</p>
              ) : (
                <ul className="divide-y">
                  {runs.map((run) => {
                    const tools = Array.isArray(run.tool_calls) ? run.tool_calls.length : 0;
                    return (
                      <li key={run.id} className="py-2 first:pt-0 last:pb-0">
                        <p className="line-clamp-2 text-xs font-medium">{run.input ?? "—"}</p>
                        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                          <span className={cn("rounded px-1.5 py-px text-[10px] font-semibold uppercase", STATUS_STYLE[run.status])}>
                            {run.status}
                          </span>
                          <span>{formatRelative(run.created_at)}</span>
                          <span>·</span>
                          <span className="tabular">
                            {tools} {tools === 1 ? "query" : "queries"}
                          </span>
                          {run.latency_ms !== null && (
                            <>
                              <span>·</span>
                              <span className="tabular">{(run.latency_ms / 1000).toFixed(1)}s</span>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
