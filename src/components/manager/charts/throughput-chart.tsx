"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyPoint } from "@/app/(app)/manager/_lib/queries";
import { formatMYR, formatNumber } from "@/lib/format";
import { AXIS_TICK, BAR_CURSOR, GRID_STROKE, SrTable, TooltipCard, Y_AXIS_WIDTH, compactNumber } from "./chart-kit";

const JOBS = "var(--chart-1)";
const REVENUE = "var(--chart-3)";

/**
 * Daily (or weekly) throughput as two aligned small multiples sharing one crosshair:
 * completed jobs (columns) above revenue (area). Two measures, two y-scales → two charts,
 * never a dual-axis plot.
 */
export function ThroughputChart({ data, granularity }: { data: DailyPoint[]; granularity: "day" | "week" }) {
  const unit = granularity === "day" ? "day" : "week";
  const peak = data.reduce<DailyPoint | null>((p, d) => (!p || d.jobs > p.jobs ? d : p), null);
  const interval = data.length > 16 ? Math.ceil(data.length / 8) - 1 : "preserveStartEnd";

  const tooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: DailyPoint }> }) => {
    const p = active ? payload?.[0]?.payload : undefined;
    if (!p) return null;
    return (
      <TooltipCard
        title={p.title}
        rows={[
          { key: "jobs", label: "jobs completed", value: formatNumber(p.jobs), color: JOBS },
          { key: "rev", label: "revenue", value: formatMYR(p.revenue), color: REVENUE, shape: "line" },
        ]}
        footer={`${formatNumber(p.created)} new orders created`}
      />
    );
  };

  return (
    <div className="relative space-y-1">
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] font-medium">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: JOBS }} />
          Jobs completed per {unit}
        </span>
        {peak && peak.jobs > 0 && (
          <span className="bg-muted text-foreground/80 rounded-md px-1.5 py-0.5 tabular-nums">
            Peak {formatNumber(peak.jobs)} · {peak.label}
          </span>
        )}
      </div>
      <div className="h-40 sm:h-44 lg:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} syncId="throughput" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" hide />
            <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={Y_AXIS_WIDTH} />
            <Tooltip cursor={BAR_CURSOR} content={tooltip} />
            <Bar dataKey="jobs" name="Jobs completed" fill={JOBS} radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="text-muted-foreground flex items-center gap-1.5 pt-2 text-[11px] font-medium">
        <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: REVENUE }} />
        Revenue per {unit} <span className="text-muted-foreground/70 font-normal">(RM)</span>
      </div>
      <div className="h-32 lg:h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} syncId="throughput" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rev-wash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={REVENUE} stopOpacity={0.18} />
                <stop offset="100%" stopColor={REVENUE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={interval} minTickGap={8} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={Y_AXIS_WIDTH} tickFormatter={compactNumber} />
            <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} content={tooltip} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={REVENUE}
              strokeWidth={2}
              fill="url(#rev-wash)"
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2, fill: REVENUE }}
              dot={false}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <SrTable
        caption={`Jobs completed and revenue per ${unit}`}
        columns={[unit === "day" ? "Day" : "Week", "Jobs completed", "Revenue", "Orders created"]}
        rows={data.map((d) => [d.title, d.jobs, formatMYR(d.revenue), d.created])}
      />
    </div>
  );
}
