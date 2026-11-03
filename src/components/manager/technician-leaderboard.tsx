"use client";

import { useMemo, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { CalendarClock, ChevronDown, Star, Trophy } from "lucide-react";
import { EASE } from "@/components/motion";
import { EmptyState } from "@/components/shared/empty-state";
import type { TechnicianKpi } from "@/lib/types";
import { formatMYR, formatNumber, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MiniToggle } from "./charts/chart-kit";

type SortKey = "jobs" | "revenue";

/** Rows shown before "Show all" — keeps the dashboard scannable with large teams. */
const COLLAPSED_ROWS = 8;

const MEDALS = [
  { ring: "ring-amber-400/70", badge: "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950", label: "Gold" },
  { ring: "ring-slate-300/80 dark:ring-slate-400/60", badge: "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900", label: "Silver" },
  { ring: "ring-orange-400/60", badge: "bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950", label: "Bronze" },
] as const;

const GRID =
  "grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 md:grid-cols-[2rem_minmax(0,1fr)_4.5rem_7rem_6rem_5.5rem_4.5rem]";

function Metric({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 md:text-right", className)}>
      <dt className="text-muted-foreground text-[10px] tracking-wide uppercase md:sr-only">{label}</dt>
      <dd className="tabular truncate text-sm">{children}</dd>
    </div>
  );
}

/**
 * Technician · Jobs completed · Total amount · Postpone/Reschedule, ranked.
 * Share bars show each technician's slice of the team total for the active sort metric.
 */
export function TechnicianLeaderboard({ rows, periodLabel }: { rows: TechnicianKpi[]; periodLabel?: string }) {
  const [sort, setSort] = useState<SortKey>("jobs");
  const [expanded, setExpanded] = useState(false);

  const { sorted, total, max } = useMemo(() => {
    const value = (r: TechnicianKpi) => (sort === "jobs" ? r.jobs_completed : r.total_amount);
    const sorted = [...rows].sort(
      (a, b) => value(b) - value(a) || (sort === "jobs" ? b.total_amount - a.total_amount : b.jobs_completed - a.jobs_completed),
    );
    const total = rows.reduce((s, r) => s + value(r), 0);
    const max = Math.max(0, ...rows.map(value));
    return { sorted, total, max };
  }, [rows, sort]);
  const collapsible = sorted.length > COLLAPSED_ROWS + 2;
  const shown = collapsible && !expanded ? sorted.slice(0, COLLAPSED_ROWS) : sorted;

  return (
    <section className="bg-card rounded-xl border shadow-xs" aria-labelledby="leaderboard-title">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 text-amber-600 ring-1 ring-amber-500/15 ring-inset dark:text-amber-300">
            <Trophy className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 id="leaderboard-title" className="text-sm leading-5 font-semibold tracking-tight">
              Technician leaderboard
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
              Jobs completed, amount collected and postponements{periodLabel ? ` · ${periodLabel}` : ""}
            </p>
          </div>
        </div>
        <MiniToggle
          className="max-sm:w-full"
          label="Rank technicians by"
          value={sort}
          onChange={setSort}
          options={[
            { value: "jobs", label: "By jobs" },
            { value: "revenue", label: "By amount" },
          ]}
        />
      </header>

      {rows.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState icon={Trophy} title="No active technicians" description="Add technicians to start tracking performance." />
        </div>
      ) : (
        <div className="mt-3">
          <div
            className={cn(
              GRID,
              "text-muted-foreground bg-muted/30 hidden border-y px-5 py-2 text-[11px] font-medium tracking-wide uppercase md:grid",
            )}
            aria-hidden
          >
            <span>#</span>
            <span>Technician</span>
            <span className={cn("text-right", sort === "jobs" && "text-foreground")}>Jobs</span>
            <span className={cn("text-right", sort === "revenue" && "text-foreground")}>Total amount</span>
            <span className="text-right">Avg ticket</span>
            <span className="text-right">Resched.</span>
            <span className="text-right">Rating</span>
          </div>
          <LayoutGroup>
            <ol
              aria-label={`Technicians ranked by ${sort === "jobs" ? "jobs completed" : "total amount"}`}
              className="divide-y border-t md:border-t-0"
            >
              {shown.map((r, i) => {
                const value = sort === "jobs" ? r.jobs_completed : r.total_amount;
                const share = total ? value / total : 0;
                const width = max ? (value / max) * 100 : 0;
                const medal = value > 0 ? MEDALS[i] : undefined;
                return (
                  <motion.li
                    key={r.technician_id}
                    layout="position"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: Math.min(i, 10) * 0.04, layout: { duration: 0.45, ease: EASE } }}
                    className={cn(
                      GRID,
                      "hover:bg-muted/40 px-4 py-3.5 transition-colors sm:px-5 md:py-3",
                      i === 0 && medal && "bg-gradient-to-r from-amber-500/[0.06] to-transparent",
                    )}
                  >
                    <span className="flex justify-center">
                      {medal ? (
                        <span
                          className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-bold shadow-sm", medal.badge)}
                          title={`${medal.label} · rank ${i + 1}`}
                        >
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-muted-foreground tabular text-xs font-medium">{i + 1}</span>
                      )}
                    </span>

                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          medal && cn("ring-2 ring-offset-2 ring-offset-card", medal.ring),
                        )}
                        aria-hidden
                      >
                        {initials(r.technician_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.technician_name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {r.branch_name} · {r.team_code}
                          {r.open_jobs > 0 && <span> · {r.open_jobs} open</span>}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                            <motion.div
                              className={cn("h-full rounded-full", medal ? "bg-gradient-brand" : "bg-primary/60")}
                              initial={{ width: 0 }}
                              animate={{ width: `${width}%` }}
                              transition={{ duration: 0.8, ease: EASE, delay: 0.15 + Math.min(i, 10) * 0.04 }}
                            />
                          </div>
                          <span className="text-muted-foreground tabular shrink-0 text-right text-[10px] whitespace-nowrap md:w-16">
                            {(share * 100).toFixed(0)}%<span className="max-sm:hidden"> of team</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <dl className="bg-muted/40 col-span-2 mt-3 grid grid-cols-4 gap-2 rounded-lg px-2.5 py-2 md:col-span-5 md:mt-0 md:grid-cols-subgrid md:bg-transparent md:p-0">
                      <Metric label="Jobs" className={cn(sort === "jobs" && "font-semibold")}>
                        {formatNumber(r.jobs_completed)}
                      </Metric>
                      <Metric label="Amount" className={cn(sort === "revenue" && "font-semibold")}>
                        <span className="md:hidden">{formatMYR(r.total_amount, { compact: true })}</span>
                        <span className="hidden md:inline">{formatMYR(r.total_amount)}</span>
                      </Metric>
                      <Metric label="Avg" className="hidden md:block">
                        <span className="text-muted-foreground md:text-foreground">
                          {r.jobs_completed ? formatMYR(r.avg_ticket, { compact: r.avg_ticket >= 10_000 }) : "—"}
                        </span>
                      </Metric>
                      <Metric label="Resched.">
                        {r.reschedules > 0 ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
                              r.reschedules >= 3
                                ? "bg-red-500/10 text-red-700 dark:text-red-300"
                                : "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                            )}
                          >
                            <CalendarClock className="size-3" aria-hidden />
                            {r.reschedules}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </Metric>
                      <Metric label="Rating">
                        {r.avg_rating !== null ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                            {r.avg_rating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Metric>
                    </dl>
                  </motion.li>
                );
              })}
            </ol>
          </LayoutGroup>
          {collapsible && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              className="text-primary hover:bg-primary/5 focus-visible:ring-ring/50 flex h-11 w-full items-center justify-center gap-1.5 border-t text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset sm:h-9"
            >
              {expanded ? "Show top " + COLLAPSED_ROWS : `Show all ${sorted.length} technicians`}
              <ChevronDown className={cn("size-3.5 transition-transform duration-300", expanded && "rotate-180")} aria-hidden />
            </button>
          )}
          <div className="text-muted-foreground bg-muted/20 flex flex-wrap justify-between gap-2 rounded-b-xl border-t px-4 py-2.5 text-xs sm:px-5">
            <span>
              Team total: <span className="text-foreground tabular font-medium">{formatNumber(rows.reduce((s, r) => s + r.jobs_completed, 0))}</span> jobs ·{" "}
              <span className="text-foreground tabular font-medium">{formatMYR(rows.reduce((s, r) => s + r.total_amount, 0))}</span>
            </span>
            <span>
              <span className="text-foreground tabular font-medium">{formatNumber(rows.reduce((s, r) => s + r.reschedules, 0))}</span> postponements
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
