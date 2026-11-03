"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Search, Wrench, X } from "lucide-react";
import { EASE } from "@/components/motion";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMYR, formatTime } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, STATUS_META } from "@/lib/workflow";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TechJob } from "@/app/(app)/tech/queries";
import { dayLabel, mytDayKey } from "./lib";
import { TechEmpty } from "./tech-empty";

const PERIODS = [
  { key: 7, label: "7 days" },
  { key: 30, label: "30 days" },
  { key: 60, label: "60 days" },
] as const;
type Period = (typeof PERIODS)[number]["key"];

const STATUSES: ("all" | OrderStatus)[] = ["all", "job_done", "reviewed", "closed"];

const completedAt = (j: TechJob) => j.completion?.completed_at ?? j.completed_at ?? null;

function groupByDay(jobs: TechJob[]) {
  const groups = new Map<string, TechJob[]>();
  for (const j of jobs) {
    const at = completedAt(j);
    if (!at) continue;
    const key = mytDayKey(at);
    groups.set(key, [...(groups.get(key) ?? []), j]);
  }
  return [...groups.entries()].map(([key, items]) => ({
    key,
    label: dayLabel(key),
    items,
    total: items.reduce((s, j) => s + (j.completion?.final_amount ?? 0), 0),
  }));
}

/** Filterable job history: grouped cards on phones, a dense table on desktop. */
export function HistoryList({ jobs }: { jobs: TechJob[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | OrderStatus>("all");
  const [period, setPeriod] = useState<Period>(60);
  // Fixed at mount so filtering stays pure across re-renders.
  const [now] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const since = now - period * 24 * 60 * 60 * 1000;
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      const at = completedAt(j);
      if (!at || new Date(at).getTime() < since) return false;
      if (status !== "all" && j.status !== status) return false;
      if (!q) return true;
      return [j.order_no, j.customer_name, j.service_type?.name, j.customer_address].some((v) => v?.toLowerCase().includes(q));
    });
  }, [jobs, query, status, period, now]);

  const days = useMemo(() => groupByDay(filtered), [filtered]);
  const total = filtered.reduce((s, j) => s + (j.completion?.final_amount ?? 0), 0);
  const filtering = query !== "" || status !== "all" || period !== 60;

  return (
    <div className="space-y-4">
      <div className="bg-card space-y-3 rounded-2xl border p-3 shadow-xs lg:flex lg:items-center lg:gap-3 lg:space-y-0">
        <label className="relative block lg:w-80">
          <span className="sr-only">Search history</span>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, order no…"
            className="bg-background focus-visible:ring-ring/40 focus-visible:border-ring h-11 w-full rounded-xl border pr-10 pl-10 text-base outline-none focus-visible:ring-3 lg:h-10 lg:text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg"
            >
              <X className="size-4" />
            </button>
          )}
        </label>

        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] lg:mx-0 lg:px-0 lg:pb-0">
          {STATUSES.map((s) => (
            <FilterPill key={s} active={status === s} onClick={() => setStatus(s)}>
              {s === "all" ? "All statuses" : STATUS_META[s].label}
            </FilterPill>
          ))}
        </div>

        <div className="bg-muted grid grid-cols-3 gap-1 rounded-xl p-1 lg:ml-auto lg:w-64" role="radiogroup" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "min-h-9 rounded-lg text-xs font-medium transition-colors lg:min-h-8",
                period === p.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-muted-foreground flex items-center justify-between px-1 text-xs">
        <span>
          <span className="text-foreground font-semibold tabular-nums">{filtered.length}</span> job
          {filtered.length === 1 ? "" : "s"}
          {filtering && " match"}
        </span>
        <span className="tabular-nums">
          Total <span className="text-foreground font-semibold">{formatMYR(total)}</span>
        </span>
      </div>

      {filtered.length === 0 ? (
        <TechEmpty
          icon="history"
          title={jobs.length ? "No jobs match these filters" : "No completed jobs yet"}
          description={
            jobs.length
              ? "Try a different search, status or period."
              : "Jobs you mark as done will be listed here with their final amounts."
          }
          action={
            filtering ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setPeriod(60);
                }}
                className="text-primary min-h-11 text-sm font-medium"
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Phones & tablets: grouped by day */}
          <div className="space-y-4 lg:hidden">
            <AnimatePresence initial={false}>
              {days.map((day, i) => (
                <motion.section
                  key={day.key}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 0.3,
                    ease: EASE,
                    delay: Math.min(i, 6) * 0.04,
                  }}
                >
                  <div className="bg-background/80 sticky top-14 z-10 -mx-4 mb-2 flex items-center justify-between px-5 py-2 backdrop-blur-xl">
                    <h2 className="text-sm font-semibold">{day.label}</h2>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {day.items.length} job{day.items.length === 1 ? "" : "s"} ·{" "}
                      <span className="text-foreground font-semibold">{formatMYR(day.total)}</span>
                    </span>
                  </div>
                  <ul className="bg-card divide-y overflow-hidden rounded-2xl border shadow-xs">
                    {day.items.map((j) => (
                      <li key={j.id}>
                        <Link
                          href={`/tech/jobs/${j.id}`}
                          className="hover:bg-muted/40 active:bg-muted/60 flex min-h-16 items-center gap-3 py-3 pr-3 pl-3.5 transition-colors"
                        >
                          <span className="bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                            <Wrench className="size-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{j.service_type?.name ?? "Aircon service"}</p>
                            <p className="text-muted-foreground truncate text-xs">
                              {j.customer_name} · {formatTime(completedAt(j))}
                            </p>
                            <p className="text-muted-foreground/80 truncate font-mono text-[11px]">{j.order_no}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-sm font-semibold tabular-nums">
                              {j.completion ? formatMYR(j.completion.final_amount) : "—"}
                            </span>
                            <StatusBadge status={j.status} className="h-5 px-2 text-[11px]" />
                          </div>
                          <ChevronRight className="text-muted-foreground/60 size-4 shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.section>
              ))}
            </AnimatePresence>
          </div>

          {/* Desktop: dense table */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
            className="bg-card hidden overflow-hidden rounded-2xl border shadow-xs lg:block"
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th className="px-5 py-3 font-medium">Completed</th>
                  <th className="px-3 py-3 font-medium">Job</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Payment</th>
                  <th className="px-3 py-3 text-right font-medium">Extra</th>
                  <th className="px-3 py-3 text-right font-medium">Final</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="w-10 px-3 py-3" aria-label="Open" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((j) => {
                  const at = completedAt(j);
                  const href = `/tech/jobs/${j.id}`;
                  return (
                    <tr
                      key={j.id}
                      onClick={() => router.push(href)}
                      className="hover:bg-muted/40 group cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="font-medium">{at ? dayLabel(mytDayKey(at)) : "—"}</p>
                        <p className="text-muted-foreground text-xs tabular-nums">{formatTime(at)}</p>
                      </td>
                      <td className="max-w-56 px-3 py-3">
                        <Link
                          href={href}
                          className="block truncate font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {j.service_type?.name ?? "Aircon service"}
                        </Link>
                        <p className="text-muted-foreground font-mono text-xs">{j.order_no}</p>
                      </td>
                      <td className="max-w-64 px-3 py-3">
                        <p className="truncate">{j.customer_name}</p>
                        <p className="text-muted-foreground truncate text-xs">{j.branch?.name ?? j.customer_address}</p>
                      </td>
                      <td className="text-muted-foreground px-3 py-3 whitespace-nowrap">
                        {j.completion?.payment_method ? PAYMENT_METHOD_LABELS[j.completion.payment_method] : "—"}
                      </td>
                      <td className="text-muted-foreground px-3 py-3 text-right tabular-nums">
                        {j.completion?.extra_charges ? formatMYR(j.completion.extra_charges) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {j.completion ? formatMYR(j.completion.final_amount) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={j.status} />
                      </td>
                      <td className="px-3 py-3">
                        <ChevronRight className="text-muted-foreground/50 group-hover:text-primary size-4 transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        </>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 lg:min-h-9 text-xs font-medium whitespace-nowrap transition-colors",
        active ? "border-primary/40 bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
