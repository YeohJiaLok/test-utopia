"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, CheckCircle2, Wallet, Wrench } from "lucide-react";
import { CountUp, EASE, Stagger, StaggerItem } from "@/components/motion";
import { formatMYR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TechJob } from "@/app/(app)/tech/queries";
import { JobCard } from "./job-card";
import { TodayPanel } from "./today-panel";
import { TechEmpty, type TechEmptyIcon } from "./tech-empty";

type TabKey = "active" | "upcoming" | "done";

const formatCount = (n: number) => Math.round(n).toString();
const wholeRinggit = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
// Whole ringgit keeps the chip readable at 360px; compact beyond RM 100k.
const formatMoney = (n: number) => (n >= 100000 ? formatMYR(n, { compact: true }) : wholeRinggit.format(Math.round(n)));

const EMPTY: Record<TabKey, { icon: TechEmptyIcon; title: string; description: string }> = {
  active: {
    icon: "coffee",
    title: "No active jobs right now",
    description: "New assignments from the office appear here instantly.",
  },
  upcoming: {
    icon: "calendar",
    title: "Nothing scheduled ahead",
    description: "Jobs booked for later days will show up here.",
  },
  done: {
    icon: "check",
    title: "No jobs completed today yet",
    description: "Finished jobs and the amount collected are tallied here.",
  },
};

const TABS: { key: TabKey; label: string; long: string }[] = [
  { key: "active", label: "Active", long: "Active jobs" },
  { key: "upcoming", label: "Upcoming", long: "Upcoming" },
  { key: "done", label: "Done", long: "Done today" },
];

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
  const lists: Record<TabKey, TechJob[]> = {
    active,
    upcoming,
    done: doneToday,
  };
  const jobs = lists[tab];
  const empty = EMPTY[tab];

  const stats = [
    {
      label: "Active",
      value: active.length,
      format: formatCount,
      icon: Wrench,
      tone: "text-primary",
      tile: "bg-primary/10",
      hint: "assigned or on site",
    },
    {
      label: "Upcoming",
      value: upcoming.length,
      format: formatCount,
      icon: CalendarDays,
      tone: "text-blue-600 dark:text-blue-300",
      tile: "bg-blue-500/10",
      hint: "booked for later days",
      wide: true,
    },
    {
      label: "Done today",
      short: "Done",
      value: doneToday.length,
      format: formatCount,
      icon: CheckCircle2,
      tone: "text-violet-600 dark:text-violet-300",
      tile: "bg-violet-500/10",
      hint: "marked Job Done",
    },
    {
      label: "Collected",
      value: collectedToday,
      format: formatMoney,
      icon: Wallet,
      tone: "text-emerald-600 dark:text-emerald-300",
      tile: "bg-emerald-500/10",
      hint: "paid on site today",
    },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.05 + i * 0.05 }}
            className={cn("bg-card rounded-2xl border p-3 shadow-xs lg:p-5", s.wide && "hidden sm:block")}
          >
            <div className="flex items-center gap-1.5 lg:gap-2.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md lg:size-9 lg:rounded-xl",
                  s.tile,
                  s.tone,
                )}
              >
                <s.icon className="size-3.5 lg:size-[18px]" />
              </span>
              <p className="text-muted-foreground truncate text-[11px] font-medium lg:text-sm">
                {"short" in s && s.short ? (
                  <>
                    <span className="sm:hidden">{s.short}</span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </>
                ) : (
                  s.label
                )}
              </p>
            </div>
            <p
              className={cn(
                "mt-1.5 truncate text-lg leading-tight font-semibold tracking-tight min-[400px]:text-xl lg:mt-3 lg:text-3xl",
                s.tone,
              )}
            >
              <CountUp value={s.value} format={s.format} />
            </p>
            <p className="text-muted-foreground mt-1 hidden text-xs lg:block">{s.hint}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <div className="bg-muted/85 sticky top-[3.75rem] z-20 -mx-1 rounded-2xl border p-1 shadow-xs backdrop-blur-md sm:mx-0 sm:max-w-md">
            <div role="tablist" aria-label="Job lists" className="grid grid-cols-3 gap-1">
              {TABS.map((t) => {
                const selected = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={`${t.long} (${lists[t.key].length})`}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "relative flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium transition-colors",
                      selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {selected && (
                      <motion.span
                        layoutId="tech-tab-pill"
                        className="bg-background absolute inset-0 rounded-xl shadow-sm"
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 38,
                        }}
                      />
                    )}
                    <span className="relative truncate">{t.label}</span>
                    <span
                      className={cn(
                        "relative min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold tabular-nums transition-colors",
                        selected ? "bg-primary text-primary-foreground" : "bg-foreground/8",
                      )}
                    >
                      {lists[t.key].length}
                    </span>
                  </button>
                );
              })}
            </div>
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
                <Stagger className="grid gap-3 md:grid-cols-2 lg:gap-4" step={0.06}>
                  {jobs.map((job, i) => (
                    <StaggerItem key={job.id} className="min-w-0">
                      <JobCard job={job} highlight={tab === "active" && i === 0} />
                    </StaggerItem>
                  ))}
                </Stagger>
              ) : (
                <TechEmpty icon={empty.icon} title={empty.title} description={empty.description} className="lg:py-20" />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <TodayPanel
          active={active}
          upcoming={upcoming}
          doneToday={doneToday}
          collectedToday={collectedToday}
          className="hidden lg:block"
        />
      </div>
    </div>
  );
}
