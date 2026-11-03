"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ServiceMixRow } from "@/app/(app)/manager/_lib/queries";
import { EASE } from "@/components/motion";
import { formatMYR, formatNumber } from "@/lib/format";
import { CATEGORICAL, MiniToggle, NEUTRAL, SrTable, TooltipCard } from "./chart-kit";

type Metric = "jobs" | "revenue";
const MAX_SLICES = 4; // + "Other" = 5 validated categorical slots

interface Slice {
  key: string;
  name: string;
  jobs: number;
  revenue: number;
  value: number;
  share: number;
  color: string;
}

/** Part-to-whole of completed work by service type. The legend doubles as the value table. */
export function ServiceMixChart({ data }: { data: ServiceMixRow[] }) {
  const [metric, setMetric] = useState<Metric>("jobs");

  const { slices, total } = useMemo(() => {
    const ranked = [...data].filter((d) => d[metric] > 0).sort((a, b) => b[metric] - a[metric]);
    const head = ranked.slice(0, MAX_SLICES);
    const tail = ranked.slice(MAX_SLICES);
    const total = ranked.reduce((s, d) => s + d[metric], 0);
    const out: Slice[] = head.map((d, i) => ({
      key: d.code,
      name: d.name,
      jobs: d.jobs,
      revenue: d.revenue,
      value: d[metric],
      share: total ? d[metric] / total : 0,
      color: CATEGORICAL[i]!,
    }));
    if (tail.length) {
      const jobs = tail.reduce((s, d) => s + d.jobs, 0);
      const revenue = tail.reduce((s, d) => s + d.revenue, 0);
      const value = metric === "jobs" ? jobs : revenue;
      out.push({
        key: "other",
        name: `Other (${tail.length})`,
        jobs,
        revenue,
        value,
        share: total ? value / total : 0,
        color: NEUTRAL,
      });
    }
    return { slices: out, total };
  }, [data, metric]);

  const fmt = (n: number) => (metric === "jobs" ? formatNumber(n) : formatMYR(n));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <MiniToggle
          label="Service mix metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "jobs", label: "Jobs" },
            { value: "revenue", label: "Revenue" },
          ]}
        />
      </div>

      {total === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">No completed jobs in this period.</p>
      ) : (
        <div className="grid items-center gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="relative mx-auto size-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    const s = active ? (payload?.[0]?.payload as Slice | undefined) : undefined;
                    if (!s) return null;
                    return (
                      <TooltipCard
                        title={s.name}
                        rows={[
                          { key: "j", label: "jobs", value: formatNumber(s.jobs), color: s.color },
                          { key: "r", label: "revenue", value: formatMYR(s.revenue) },
                          { key: "s", label: "of total", value: `${(s.share * 100).toFixed(0)}%` },
                        ]}
                      />
                    );
                  }}
                />
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={86}
                  paddingAngle={slices.length > 1 ? 2 : 0}
                  cornerRadius={4}
                  stroke="var(--card)"
                  strokeWidth={2}
                  startAngle={90}
                  endAngle={-270}
                  animationDuration={800}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold tracking-tight">
                {metric === "jobs" ? formatNumber(total) : formatMYR(total, { compact: true })}
              </span>
              <span className="text-muted-foreground text-[11px]">{metric === "jobs" ? "jobs" : "revenue"}</span>
            </div>
          </div>

          <ul className="min-w-0 space-y-2.5" aria-label="Service mix breakdown">
            {slices.map((s, i) => (
              <li key={s.key} className="min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <span className="tabular font-semibold">{fmt(s.value)}</span>
                  <span className="text-muted-foreground tabular w-9 text-right">{(s.share * 100).toFixed(0)}%</span>
                </div>
                <div className="bg-muted mt-1 ml-[18px] h-1 overflow-hidden rounded-full">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: s.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${s.share * 100}%` }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.05 }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SrTable
        caption="Completed jobs and revenue by service type"
        columns={["Service", "Jobs", "Revenue"]}
        rows={data.map((d) => [d.name, d.jobs, formatMYR(d.revenue)])}
      />
    </div>
  );
}
