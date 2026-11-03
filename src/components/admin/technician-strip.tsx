"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ChevronDown, Users } from "lucide-react";
import { EASE } from "@/components/motion";
import { EmptyState } from "@/components/shared/empty-state";
import { initials } from "@/lib/format";
import type { TechnicianWithLoad } from "@/lib/data/reference";
import { cn } from "@/lib/utils";
import { LoadMeter } from "./load-meter";
import { LOAD_META, loadLevel, type LoadLevel } from "./load-level";

const LEVELS: LoadLevel[] = ["free", "light", "busy", "full"];
const PREVIEW = 6;

/** Availability board: load summary + who is free, who is on site, who is fully booked. */
export function TechnicianStrip({ technicians, onSiteIds }: { technicians: TechnicianWithLoad[]; onSiteIds: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const onSite = new Set(onSiteIds);
  const sorted = [...technicians].sort((a, b) => a.open_jobs - b.open_jobs || a.name.localeCompare(b.name));
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, technicians.filter((t) => loadLevel(t.open_jobs) === l).length])) as Record<
    LoadLevel,
    number
  >;
  const total = technicians.length;
  const shown = expanded ? sorted : sorted.slice(0, PREVIEW);

  return (
    <section className="bg-card rounded-xl border shadow-xs" aria-labelledby="tech-availability">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 id="tech-availability" className="text-sm font-semibold">
            Technician availability
          </h2>
          <p className="text-muted-foreground text-xs">
            <span className="text-foreground font-medium tabular">{byLevel.free}</span> of <span className="tabular">{total}</span> free now ·
            least-loaded first
          </p>
        </div>
        <Link
          href="/admin/technicians"
          className="text-primary -my-1 inline-flex h-8 shrink-0 items-center gap-0.5 rounded-md px-2 text-xs font-medium hover:underline"
        >
          Roster <ArrowUpRight className="size-3.5" />
        </Link>
      </header>

      {total > 0 && (
        <div className="space-y-2.5 px-4 pt-3.5">
          {/* Fleet load distribution doubles as the legend */}
          <div className="bg-muted flex h-2 overflow-hidden rounded-full" aria-hidden>
            {LEVELS.map((l, i) => (
              <motion.span
                key={l}
                className={cn("h-full", LOAD_META[l].bar)}
                initial={{ width: 0 }}
                animate={{ width: `${(byLevel[l] / total) * 100}%` }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.05 }}
              />
            ))}
          </div>
          <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {LEVELS.map((l) => (
              <li key={l} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", LOAD_META[l].dot)} />
                {LOAD_META[l].label}
                <span className="text-foreground font-semibold tabular">{byLevel[l]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {total ? (
        <>
          <ul className="grid gap-2 p-3 sm:grid-cols-2 2xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {shown.map((t, i) => {
                const level = loadLevel(t.open_jobs);
                const live = onSite.has(t.id);
                return (
                  <motion.li
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.3, ease: EASE, delay: i < PREVIEW ? 0.1 + i * 0.03 : (i - PREVIEW) * 0.02 }}
                    className="min-w-0"
                  >
                    <Link
                      href={`/admin/orders?tech=${t.id}`}
                      className="hover:border-primary/30 hover:bg-accent/40 focus-visible:ring-ring/50 group flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors outline-none focus-visible:ring-3"
                    >
                      <span className="bg-primary/10 text-primary relative flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                        {initials(t.name)}
                        <span className={cn("ring-card absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2", LOAD_META[level].dot)} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium">{t.name}</span>
                          {live && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/12 px-1.5 py-px text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                              <span className="relative flex size-1.5">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-60" />
                                <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                              </span>
                              On site
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {t.team_code} · {t.branch_name}
                        </span>
                      </span>
                      <span className="flex w-16 shrink-0 flex-col items-end gap-1">
                        <span className={cn("text-[11px] font-medium whitespace-nowrap", LOAD_META[level].text)}>
                          {t.open_jobs} open
                        </span>
                        <LoadMeter openJobs={t.open_jobs} delay={0.2 + Math.min(i, PREVIEW) * 0.03} className="w-full" />
                      </span>
                    </Link>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          {sorted.length > PREVIEW && (
            <div className="border-t px-3 py-1.5">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex h-10 w-full items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors sm:h-8"
              >
                {expanded ? "Show fewer" : `Show all ${sorted.length} technicians`}
                <ChevronDown className={cn("size-3.5 transition-transform duration-300", expanded && "rotate-180")} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="p-4">
          <EmptyState icon={Users} title="No active technicians" description="Add technicians in Users & roles to start dispatching." className="py-8" />
        </div>
      )}
    </section>
  );
}
