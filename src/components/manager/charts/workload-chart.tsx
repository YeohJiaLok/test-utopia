"use client";

import { AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WorkloadStat } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { LOAD_META, formatSigma, loadLevel, type LoadLevel } from "../workload";
import { AXIS_TICK, BAR_CURSOR, CategoryTick, GRID_STROKE, SrTable, TooltipCard } from "./chart-kit";


/** Jobs completed per technician against the team mean; bars above +1.5σ wear warning/critical status colours. */
export function WorkloadChart({ data }: { data: WorkloadStat[] }) {
  const rows = [...data].sort((a, b) => b.jobs_completed - a.jobs_completed);
  const mean = data[0]?.team_mean ?? 0;
  const present = new Set<LoadLevel>(rows.map((r) => loadLevel(r)));
  const legend = (["critical", "overloaded", "balanced", "underloaded"] as LoadLevel[]).filter((l) => present.has(l) || l === "balanced");

  if (!rows.length) {
    return <p className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">No active technicians.</p>;
  }

  return (
    <div className="relative space-y-3">
      <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]" aria-label="Legend">
        {legend.map((l) => (
          <li key={l} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: LOAD_META[l].color }} />
            {(l === "critical" || l === "overloaded") && <AlertTriangle className="size-3" aria-hidden />}
            {LOAD_META[l].label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="bg-foreground/60 h-0.5 w-3 rounded-full" />
          Team mean {mean.toFixed(1)}
        </li>
      </ul>
      <div className="relative" style={{ height: Math.max(160, rows.length * 28 + 28) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="24%">
            <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
            <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="technician_name" tick={<CategoryTick />} axisLine={false} tickLine={false} width={100} interval={0} />
            <Tooltip
              cursor={BAR_CURSOR}
              content={({ active, payload }) => {
                const w = active ? (payload?.[0]?.payload as WorkloadStat | undefined) : undefined;
                if (!w) return null;
                const level = loadLevel(w);
                return (
                  <TooltipCard
                    title={`${w.technician_name} · ${w.branch_name}`}
                    rows={[
                      { key: "j", label: "jobs completed", value: formatNumber(w.jobs_completed), color: LOAD_META[level].color },
                      { key: "o", label: "open jobs now", value: formatNumber(w.open_jobs) },
                      { key: "r", label: "reschedules", value: formatNumber(w.reschedules) },
                      { key: "z", label: "vs team mean", value: formatSigma(w.z_score) },
                    ]}
                    footer={LOAD_META[level].label}
                  />
                );
              }}
            />
            <ReferenceLine
              x={mean}
              stroke="var(--foreground)"
              strokeOpacity={0.55}
              strokeWidth={1.5}
              ifOverflow="extendDomain"
              label={{ value: "mean", position: "top", fill: "var(--muted-foreground)", fontSize: 10 }}
            />
            <Bar dataKey="jobs_completed" name="Jobs completed" radius={[0, 4, 4, 0]} maxBarSize={18} animationDuration={700}>
              {rows.map((r) => (
                <Cell key={r.technician_id} fill={LOAD_META[loadLevel(r)].color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SrTable
        caption="Technician workload versus team mean"
        columns={["Technician", "Jobs completed", "Open jobs", "Reschedules", "Deviation", "Status"]}
        rows={rows.map((w) => [
          w.technician_name,
          w.jobs_completed,
          w.open_jobs,
          w.reschedules,
          formatSigma(w.z_score),
          LOAD_META[loadLevel(w)].label,
        ])}
      />
    </div>
  );
}
