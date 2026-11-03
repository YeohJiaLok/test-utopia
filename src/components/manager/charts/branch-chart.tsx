"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BranchRow } from "@/app/(app)/manager/_lib/queries";
import { formatMYR, formatNumber } from "@/lib/format";
import { AXIS_TICK, BAR_CURSOR, CategoryTick, GRID_STROKE, MiniToggle, SrTable, TooltipCard, compactMYR } from "./chart-kit";

type Metric = "jobs" | "revenue" | "openJobs";
const COLOR = "var(--chart-1)";
const LABELS: Record<Metric, string> = { jobs: "Jobs completed", revenue: "Revenue", openJobs: "Open jobs" };

/** Branch comparison: one measure at a time, ranked horizontal bars with the value at the tip. */
export function BranchChart({ data }: { data: BranchRow[] }) {
  const [metric, setMetric] = useState<Metric>("jobs");
  const rows = [...data].sort((a, b) => b[metric] - a[metric]);
  const fmt = (n: number) => (metric === "revenue" ? formatMYR(n, { compact: n >= 10_000 }) : formatNumber(n));

  return (
    <div className="relative space-y-3">
      <div className="flex justify-end">
        <MiniToggle
          className="max-sm:w-full"
          label="Branch metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "jobs", label: "Jobs" },
            { value: "revenue", label: "Revenue" },
            { value: "openJobs", label: "Open" },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">No branches configured.</p>
      ) : (
        <div style={{ height: Math.max(140, rows.length * 40 + 24) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
              <XAxis
                type="number"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tickFormatter={metric === "revenue" ? compactMYR : undefined}
              />
              <YAxis type="category" dataKey="name" tick={<CategoryTick maxChars={16} />} axisLine={false} tickLine={false} width={104} interval={0} />
              <Tooltip
                cursor={BAR_CURSOR}
                content={({ active, payload }) => {
                  const b = active ? (payload?.[0]?.payload as BranchRow | undefined) : undefined;
                  if (!b) return null;
                  return (
                    <TooltipCard
                      title={b.name}
                      rows={[
                        { key: "j", label: "jobs completed", value: formatNumber(b.jobs), color: metric === "jobs" ? COLOR : undefined },
                        { key: "r", label: "revenue", value: formatMYR(b.revenue), color: metric === "revenue" ? COLOR : undefined },
                        { key: "o", label: "open jobs now", value: formatNumber(b.openJobs), color: metric === "openJobs" ? COLOR : undefined },
                      ]}
                      footer={`${b.technicians} active technician${b.technicians === 1 ? "" : "s"}`}
                    />
                  );
                }}
              />
              <Bar dataKey={metric} name={LABELS[metric]} fill={COLOR} radius={[0, 4, 4, 0]} maxBarSize={20} animationDuration={700}>
                <LabelList
                  dataKey={metric}
                  position="right"
                  formatter={(v: unknown) => fmt(Number(v))}
                  style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <SrTable
        caption="Branch comparison"
        columns={["Branch", "Jobs completed", "Revenue", "Open jobs", "Technicians"]}
        rows={data.map((b) => [b.name, b.jobs, formatMYR(b.revenue), b.openJobs, b.technicians])}
      />
    </div>
  );
}
