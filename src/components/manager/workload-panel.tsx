import { ArrowRight, BatteryLow, Flame, Scale } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import type { WorkloadStat } from "@/lib/types";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OVERLOAD_Z, UNDERLOAD_Z, formatSigma, loadLevel } from "./workload";

function Person({ w, tone }: { w: WorkloadStat; tone: "hot" | "cool" }) {
  const level = loadLevel(w);
  return (
    <StaggerItem className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          tone === "hot" ? "bg-amber-500/12 text-amber-700 dark:text-amber-300" : "bg-sky-500/10 text-sky-700 dark:text-sky-300",
        )}
      >
        {initials(w.technician_name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{w.technician_name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {w.branch_name} · {w.jobs_completed} done · {w.open_jobs} open
        </p>
      </div>
      <span
        className={cn(
          "tabular rounded-md px-1.5 py-0.5 text-xs font-semibold",
          level === "critical" && "bg-red-500/10 text-red-700 dark:text-red-300",
          level === "overloaded" && "bg-amber-500/12 text-amber-700 dark:text-amber-300",
          level === "underloaded" && "bg-sky-500/10 text-sky-700 dark:text-sky-300",
        )}
      >
        {formatSigma(w.z_score)}
      </span>
    </StaggerItem>
  );
}

/** Deterministic rebalancing hint: busiest overloaded tech → least-loaded peer, same branch when possible. */
function suggestion(hot: WorkloadStat[], cool: WorkloadStat[], all: WorkloadStat[]) {
  const from = hot[0];
  if (!from) return null;
  const pool = cool.length ? cool : [...all].sort((a, b) => a.z_score - b.z_score).filter((w) => w.technician_id !== from.technician_id);
  const to = pool.find((w) => w.branch_name === from.branch_name) ?? pool[0];
  if (!to) return null;
  return { from, to };
}

export function WorkloadPanel({ data }: { data: WorkloadStat[] }) {
  const hot = data.filter((w) => w.z_score >= OVERLOAD_Z).sort((a, b) => b.z_score - a.z_score);
  const cool = data.filter((w) => w.z_score <= UNDERLOAD_Z).sort((a, b) => a.z_score - b.z_score);
  const mean = data[0]?.team_mean ?? 0;
  const sd = data[0]?.team_stddev ?? 0;
  const hint = suggestion(hot, cool, data);

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Team mean", value: mean.toFixed(1) },
          { label: "Std. dev.", value: sd.toFixed(1) },
          { label: "Technicians", value: String(data.length) },
        ].map((s) => (
          <div key={s.label} className="bg-muted/60 rounded-lg px-2 py-2">
            <dt className="text-muted-foreground text-[11px]">{s.label}</dt>
            <dd className="tabular text-sm font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>

      {!hot.length && !cool.length ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <Scale className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm">
            <span className="font-medium">Workload is balanced.</span>{" "}
            <span className="text-muted-foreground">No technician is more than 1.5σ from the team mean this period.</span>
          </p>
        </div>
      ) : (
        <>
          {hot.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Flame className="size-3.5" /> Overloaded ({hot.length})
              </h3>
              <Stagger className="space-y-2">
                {hot.map((w) => (
                  <Person key={w.technician_id} w={w} tone="hot" />
                ))}
              </Stagger>
            </div>
          )}
          {cool.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
                <BatteryLow className="size-3.5" /> Spare capacity ({cool.length})
              </h3>
              <Stagger className="space-y-2" delay={0.1}>
                {cool.map((w) => (
                  <Person key={w.technician_id} w={w} tone="cool" />
                ))}
              </Stagger>
            </div>
          )}
          {hint && (
            <div className="bg-primary/5 border-primary/15 rounded-lg border p-3 text-xs">
              <p className="text-primary mb-1 font-semibold">Suggested rebalance</p>
              <p className="flex flex-wrap items-center gap-1">
                Route new jobs from <span className="font-medium">{hint.from.technician_name}</span>
                <ArrowRight className="text-muted-foreground size-3" />
                <span className="font-medium">{hint.to.technician_name}</span>
                <span className="text-muted-foreground">
                  ({hint.to.branch_name === hint.from.branch_name ? `same branch, ${hint.to.open_jobs} open` : hint.to.branch_name})
                </span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
