"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, CheckCircle2, Coffee, Wrench } from "lucide-react";
import { CountUp, EASE, Stagger, StaggerItem } from "@/components/motion";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMYR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TechJob } from "@/app/(app)/tech/queries";
import { JobCard } from "./job-card";

type TabKey = "active" | "upcoming" | "done";

const formatCount = (n: number) => Math.round(n).toString();
const wholeRinggit = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
// Whole ringgit keeps the chip readable at 360px; compact beyond RM 100k.
const formatMoney = (n: number) => (n >= 100000 ? formatMYR(n, { compact: true }) : wholeRinggit.format(Math.round(n)));

const EMPTY: Record<TabKey, { icon: typeof Wrench; title: string; description: string }> = {
  active: {
    icon: Coffee,
    title: "No active jobs right now",
    description: "New assignments from the office appear here instantly.",
  },
  upcoming: {
    icon: CalendarDays,
    title: "Nothing scheduled ahead",
    description: "Jobs booked for later days will show up here.",
  },
  done: {
    icon: CheckCircle2,
    title: "No jobs completed today yet",
    description: "Finished jobs and the amount collected are tallied here.",
  },
};

export function JobsBoard({
  active,
  upcoming,
  doneToday,
  collectedToday,
}: {
  active: TechJob[];
  upcoming: TechJob[];
  doneToday: TechJob[];
  collectedToday: number;
}) {
  const [tab, setTab] = useState<TabKey>("active");
  const lists: Record<TabKey, TechJob[]> = { active, upcoming, done: doneToday };
  const tabs: { key: TabKey; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "upcoming", label: "Upcoming" },
    { key: "done", label: "Done today" },
  ];
  const jobs = lists[tab];
  const empty = EMPTY[tab];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Active jobs", value: active.length, format: formatCount, tone: "text-primary" },
          { label: "Done today", value: doneToday.length, format: formatCount, tone: "text-violet-600 dark:text-violet-300" },
          { label: "Collected", value: collectedToday, format: formatMoney, tone: "text-emerald-600 dark:text-emerald-300" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.05 + i * 0.05 }}
            className="bg-card rounded-xl border px-3 py-2.5 shadow-xs"
          >
            <p className="text-muted-foreground text-[11px] font-medium">{s.label}</p>
            <p className={cn("mt-0.5 truncate text-base font-semibold tracking-tight min-[400px]:text-lg", s.tone)}>
              <CountUp value={s.value} format={s.format} />
            </p>
          </motion.div>
        ))}
      </div>

      <div role="tablist" aria-label="Job lists" className="bg-muted grid grid-cols-3 gap-1 rounded-xl p-1">
        {tabs.map((t) => {
          const selected = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors",
                selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {selected && (
                <motion.span
                  layoutId="tech-tab-pill"
                  className="bg-background absolute inset-0 rounded-lg shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative truncate">{t.label}</span>
              <span
                className={cn(
                  "relative rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  selected ? "bg-primary/12 text-primary" : "bg-foreground/5",
                )}
              >
                {lists[t.key].length}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: EASE }}
        >
          {jobs.length ? (
            <Stagger className="space-y-3" step={0.06}>
              {jobs.map((job, i) => (
                <StaggerItem key={job.id}>
                  <JobCard job={job} highlight={tab === "active" && i === 0} />
                </StaggerItem>
              ))}
            </Stagger>
          ) : (
            <EmptyState icon={empty.icon} title={empty.title} description={empty.description} className="bg-card/50" />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
