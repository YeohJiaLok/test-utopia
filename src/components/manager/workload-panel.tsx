import { ArrowRight, BatteryLow, Flame, Moon, Scale, Shuffle } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import type { WorkloadStat } from "@/lib/types";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OVERLOAD_Z, UNDERLOAD_Z, formatSigma, loadLevel } from "./workload";

function Person({ w, tone }: { w: WorkloadStat; tone: "hot" | "cool" }) {
  const level = loadLevel(w);
  return (
    <StaggerItem className="bg-card flex items-center gap-3 rounded-lg border px-3 py-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          tone === "hot" ? "bg-amber-500/12 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary",
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
          level === "underloaded" && "bg-primary/10 text-primary",
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
  const idle = data.filter((w) => w.jobs_completed === 0).sort((a, b) => b.open_jobs - a.open_jobs);
  const withinRange = data.length - hot.length - cool.length;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Team mean", value: mean.toFixed(1) },
          { label: "Std. dev.", value: sd.toFixed(1) },
          { label: "Technicians", value: String(data.length) },
        ].map((s) => (
          <div key={s.label} className="bg-muted/50 ring-foreground/[0.04] rounded-lg px-2 py-2.5 ring-1 ring-inset">
            <dt className="text-muted-foreground truncate text-[11px]">{s.label}</dt>
            <dd className="tabular mt-0.5 text-base font-semibold tracking-tight">{s.value}</dd>
          </div>
        ))}
      </dl>

      {data.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-muted-foreground flex items-center justify-between text-[11px] font-medium">
            <span>Distribution</span>
            <span className="tabular">
              {hot.length} high · {withinRange} in range · {cool.length} spare
            </span>
          </div>
          <div className="bg-muted flex h-2 overflow-hidden rounded-full" aria-hidden>
            <span className="h-full bg-[var(--warning)]" style={{ width: `${(hot.length / data.length) * 100}%` }} />
            <span className="h-full bg-[var(--chart-1)]" style={{ width: `${(withinRange / data.length) * 100}%` }} />
            <span
              className="h-full bg-[color-mix(in_oklch,var(--chart-1)_40%,transparent)]"
              style={{ width: `${(cool.length / data.length) * 100}%` }}
            />
          </div>
        </div>
      )}

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
              <h3 className="text-primary flex items-center gap-1.5 text-xs font-semibold">
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
              <p className="text-primary mb-1.5 flex items-center gap-1.5 font-semibold">
                <Shuffle className="size-3.5" aria-hidden /> Suggested rebalance
              </p>
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

      {idle.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
            <Moon className="size-3.5" /> No completions this period ({idle.length})
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {idle.map((w) => (
              <li
                key={w.technician_id}
                className="bg-muted/60 text-foreground/80 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                title={`${w.branch_name} · ${w.open_jobs} open`}
              >
                {w.technician_name}
                {w.open_jobs > 0 && <span className="text-muted-foreground tabular">· {w.open_jobs} open</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
