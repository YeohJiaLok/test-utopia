"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { EASE } from "@/components/motion";
import { initials } from "@/lib/format";
import type { TechnicianWithLoad } from "@/lib/data/reference";
import { cn } from "@/lib/utils";
import { LOAD_META, LoadMeter, loadLevel } from "./load-meter";

/** Horizontal availability strip: who is free, who is on site, who is fully booked. */
export function TechnicianStrip({ technicians, onSiteIds }: { technicians: TechnicianWithLoad[]; onSiteIds: string[] }) {
  const onSite = new Set(onSiteIds);
  const sorted = [...technicians].sort((a, b) => a.open_jobs - b.open_jobs || a.name.localeCompare(b.name));
  const free = technicians.filter((t) => t.open_jobs === 0).length;

  return (
    <section className="bg-card rounded-xl border shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Technician availability</h2>
          <p className="text-muted-foreground text-xs">
            <span className="tabular">{free}</span> of <span className="tabular">{technicians.length}</span> available now
          </p>
        </div>
        <div className="text-muted-foreground hidden items-center gap-3 text-[11px] sm:flex">
          {(["free", "light", "busy", "full"] as const).map((l) => (
            <span key={l} className="inline-flex items-center gap-1">
              <span className={cn("size-2 rounded-full", LOAD_META[l].dot)} />
              {LOAD_META[l].label}
            </span>
          ))}
        </div>
      </header>
      <div className="scrollbar-thin flex snap-x gap-2.5 overflow-x-auto p-3">
        {sorted.map((t, i) => {
          const level = loadLevel(t.open_jobs);
          const live = onSite.has(t.id);
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE, delay: 0.1 + i * 0.03 }}
              className="w-40 shrink-0 snap-start"
            >
              <Link
                href={`/admin/orders?tech=${t.id}`}
                className="hover:border-primary/40 bg-background flex h-full flex-col gap-2 rounded-lg border p-2.5 transition-colors hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary relative flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                    {initials(t.name)}
                    <span className={cn("ring-background absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2", LOAD_META[level].dot)} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{t.name}</span>
                    <span className="text-muted-foreground block truncate text-[11px]">{t.branch_name}</span>
                  </span>
                </div>
                <LoadMeter openJobs={t.open_jobs} delay={0.2 + i * 0.03} />
                <div className="flex items-center justify-between text-[11px]">
                  <span className={cn("font-medium", LOAD_META[level].text)}>{LOAD_META[level].label}</span>
                  {live ? (
                    <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                      <span className="relative flex size-1.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-60" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                      </span>
                      On site
                    </span>
                  ) : (
                    <span className="text-muted-foreground tabular">{t.open_jobs} open</span>
                  )}
                </div>
              </Link>
            </motion.div>
          );
        })}
        {!sorted.length && <p className="text-muted-foreground px-1 py-4 text-sm">No active technicians.</p>}
      </div>
    </section>
  );
}
