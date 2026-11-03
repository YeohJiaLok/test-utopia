"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Cog, Flame, Info, KeyRound, Lightbulb, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EASE, Stagger, StaggerItem } from "@/components/motion";
import { formatDate, formatMYR, formatRelative } from "@/lib/format";
import type { InsightPayload, InsightTone } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

type State = { status: "loading" } | { status: "ready"; data: InsightPayload } | { status: "error"; error: string };

const TONE: Record<InsightTone, { icon: typeof Info; className: string }> = {
  positive: { icon: TrendingUp, className: "bg-success/12 text-success" },
  neutral: { icon: Info, className: "bg-primary/10 text-primary" },
  warning: { icon: AlertTriangle, className: "bg-warning/15 text-warning" },
};

async function fetchInsights(force: boolean): Promise<InsightPayload> {
  const res = await fetch("/api/ai/insights", { method: force ? "POST" : "GET", cache: "no-store" });
  const body = (await res.json().catch(() => null)) as (InsightPayload & { ok: true }) | { ok: false; error: string } | null;
  if (!res.ok || !body || !body.ok) throw new Error(body && !body.ok ? body.error : `Request failed (${res.status})`);
  return body;
}

function Shimmer({ className }: { className?: string }) {
  return <div className={cn("bg-muted/70 shimmer rounded-md", className)} />;
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Generating briefing">
      <Shimmer className="h-6 w-4/5" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Shimmer key={i} className="h-14" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-2.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Shimmer key={i} className="h-12" />
          ))}
        </div>
        <Shimmer className="h-40" />
      </div>
    </div>
  );
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground text-[11px]">no baseline</span>;
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center text-[11px] font-medium", up ? "text-success" : "text-destructive")}>
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

function Metric({ label, value, delta }: { label: string; value: string; delta?: React.ReactNode }) {
  return (
    <div className="bg-muted/40 ring-foreground/[0.04] h-full rounded-lg px-3 py-2 ring-1 ring-inset">
      <p className="text-muted-foreground truncate text-[11px]">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="tabular text-base font-semibold">{value}</span>
        {delta}
      </div>
    </div>
  );
}

function Briefing({ data }: { data: InsightPayload }) {
  const { briefing, stats } = data;
  return (
    <div className="space-y-4">
      <motion.h3
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="text-lg leading-snug font-semibold tracking-tight text-balance"
      >
        {briefing.headline}
      </motion.h3>

      <Stagger className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" step={0.05}>
        <StaggerItem>
          <Metric label="Jobs completed" value={String(stats.thisWeek.jobsCompleted)} delta={<Delta pct={stats.change.jobsCompleted} />} />
        </StaggerItem>
        <StaggerItem>
          <Metric label="Revenue" value={formatMYR(stats.thisWeek.revenue, { compact: true })} delta={<Delta pct={stats.change.revenue} />} />
        </StaggerItem>
        <StaggerItem>
          <Metric label="Open flags" value={String(stats.openFlags.total)} delta={stats.openFlags.high ? <span className="text-destructive text-[11px]">{stats.openFlags.high} high</span> : undefined} />
        </StaggerItem>
        <StaggerItem>
          <Metric label="Awaiting review" value={String(stats.backlog.awaitingReview)} />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Stagger className="space-y-2" delay={0.15} step={0.07}>
          {briefing.highlights.map((h, i) => {
            const tone = TONE[h.tone];
            const Icon = tone.icon;
            return (
              <StaggerItem key={i} className="bg-card hover:bg-muted/30 flex gap-3 rounded-lg border px-3 py-2.5 transition-colors">
                <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md", tone.className)}>
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{h.title}</p>
                  <p className="text-muted-foreground text-sm leading-snug">{h.detail}</p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>

        <Stagger className="space-y-3" delay={0.3} step={0.08}>
          {briefing.overloaded.length > 0 && (
            <StaggerItem className="border-warning/30 bg-warning/[0.06] rounded-lg border p-3">
              <p className="text-warning flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                <Flame className="size-3.5" /> Possible overload
              </p>
              <ul className="mt-2 space-y-2">
                {briefing.overloaded.map((o) => (
                  <li key={o.technician} className="text-sm">
                    <span className="font-medium">{o.technician}</span> completed{" "}
                    <span className="tabular font-medium">{o.jobs}</span> jobs this week,{" "}
                    <span className="tabular font-medium">{o.z_score.toFixed(1)}σ</span> above team average.
                    {o.note && <span className="text-muted-foreground block text-xs leading-snug">{o.note}</span>}
                  </li>
                ))}
              </ul>
            </StaggerItem>
          )}
          <StaggerItem className="rounded-lg border p-3">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <Lightbulb className="size-3.5" /> Recommended this week
            </p>
            <ol className="mt-2 space-y-1.5">
              {briefing.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm leading-snug">
                  <span className="bg-primary/10 text-primary tabular mt-0.5 flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold">
                    {i + 1}
                  </span>
                  {r}
                </li>
              ))}
            </ol>
          </StaggerItem>
        </Stagger>
      </div>
    </div>
  );
}

/** Weekly AI operational briefing for the manager dashboard. */
export function AiBriefingCard({ className }: { className?: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  const load = useCallback(async (force: boolean) => {
    try {
      const data = await fetchInsights(force);
      setState({ status: "ready", data });
    } catch (err) {
      setState((prev) =>
        prev.status === "ready" ? prev : { status: "error", error: err instanceof Error ? err.message : "Could not load the briefing." },
      );
      if (force) throw err;
    }
  }, []);

  useEffect(() => {
    void load(false);
    // Re-render periodically so "Generated x min ago" stays accurate.
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load(true);
    } catch {
      // the error state / previous briefing is already shown
    } finally {
      setRefreshing(false);
    }
  }

  const data = state.status === "ready" ? state.data : null;

  return (
    <div
      className={cn(
        "rounded-2xl bg-[linear-gradient(135deg,var(--brand),color-mix(in_oklch,var(--brand-2)_70%,transparent)_35%,var(--border)_70%)] p-px shadow-sm",
        className,
      )}
    >
      <section className="bg-card relative overflow-hidden rounded-[calc(1rem-1px)] p-4 sm:p-5">
        <div aria-hidden className="bg-brand/10 pointer-events-none absolute -top-24 -right-20 size-56 rounded-full blur-3xl" />
        <header className="relative mb-4 flex flex-wrap items-start gap-x-3 gap-y-2">
          <span className="bg-gradient-brand shadow-brand/25 flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5 font-semibold">
              AI operational briefing
              {data && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold tracking-wide uppercase",
                    data.source === "ai" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground ring-border ring-1 ring-inset",
                  )}
                >
                  {data.source === "ai" ? <Sparkles className="size-2.5" /> : <Cog className="size-2.5" />}
                  {data.source === "ai" ? "AI" : "Rule-based"}
                </span>
              )}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {data ? `Week of ${formatDate(data.stats.periodStart)} · this week vs same days last week` : "This week vs last week"}
            </p>
          </div>
          <div className="text-muted-foreground flex w-full items-center justify-between gap-2 text-xs sm:w-auto sm:justify-end">
            {data ? <span>Generated {formatRelative(data.generatedAt)}</span> : <span />}
            <Button
              variant="outline"
              size="sm"
              className="max-sm:h-10 max-sm:px-3"
              onClick={refresh}
              disabled={refreshing || state.status === "loading"}
            >
              <RefreshCw className={cn(refreshing && "animate-spin")} />
              {refreshing ? "Generating…" : "Refresh"}
            </Button>
          </div>
        </header>

        <div className="relative">
          <AnimatePresence mode="wait" initial={false}>
            {state.status === "loading" || (refreshing && !data) ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LoadingState />
              </motion.div>
            ) : state.status === "error" ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-warning/30 bg-warning/[0.06] flex items-start gap-3 rounded-lg border p-3 text-sm"
              >
                <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium">The briefing could not be generated</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{state.error}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={data!.generatedAt}
                initial={{ opacity: 0 }}
                animate={{ opacity: refreshing ? 0.55 : 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Briefing data={data!} />
                {data!.notice && (
                  <p className="bg-muted/40 text-muted-foreground mt-4 flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
                    {data!.source === "ai" ? (
                      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                    ) : (
                      <KeyRound className="mt-px size-3.5 shrink-0" aria-hidden />
                    )}
                    <span>
                      {data!.notice}
                      {data!.source !== "ai" && (
                        <span className="text-muted-foreground/80">
                          {" "}
                          Figures and recommendations are computed deterministically from live data.
                        </span>
                      )}
                    </span>
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
