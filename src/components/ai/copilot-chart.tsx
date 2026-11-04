"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, ChartLine, ChartPie, Download, Rows3 } from "lucide-react";
import { EASE } from "@/components/motion";
import { AXIS_TICK, BAR_CURSOR, CATEGORICAL, CategoryTick, GRID_STROKE, SrTable, TooltipCard, compactMYR } from "@/components/manager/charts/chart-kit";
import { formatMYR, formatNumber } from "@/lib/format";
import type { ChartSpec } from "@/lib/ai/contracts";
import { cn } from "@/lib/utils";

type Kind = ChartSpec["type"];
const SERIES_COLORS = ["var(--chart-5)", "var(--chart-2)"];

const KIND_META: Record<Kind, { label: string; icon: typeof BarChart3 }> = {
  horizontal_bar: { label: "Ranking", icon: Rows3 },
  bar: { label: "Bars", icon: BarChart3 },
  line: { label: "Line", icon: ChartLine },
  area: { label: "Area", icon: ChartLine },
  pie: { label: "Share", icon: ChartPie },
};

function formatter(unit: ChartSpec["unit"]) {
  switch (unit) {
    case "myr":
      return (v: number) => formatMYR(v);
    case "percent":
      return (v: number) => `${formatNumber(v)}%`;
    case "hours":
      return (v: number) => `${formatNumber(v)} h`;
    default:
      return (v: number) => formatNumber(v);
  }
}

function axisFormatter(unit: ChartSpec["unit"]) {
  if (unit === "myr") return compactMYR;
  if (unit === "percent") return (v: number) => `${v}%`;
  return (v: number) => formatNumber(v);
}

/** Chart types that can show the same data: the toggle lets the reader switch, like a BI tool. */
function alternatives(spec: ChartSpec): Kind[] {
  const kinds: Kind[] = ["horizontal_bar", "bar", "line"];
  if (spec.series.length === 1 && spec.data.length <= 8 && spec.data.every((d) => d.values[0]! >= 0)) kinds.push("pie");
  if (!kinds.includes(spec.type)) kinds.unshift(spec.type);
  return kinds;
}

function downloadCsv(spec: ChartSpec) {
  const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = [["Label", ...spec.series].map(esc).join(","), ...spec.data.map((d) => [d.label, ...d.values].map(esc).join(","))];
  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${spec.title.replace(/[^\w-]+/g, "-").toLowerCase().slice(0, 60) || "chart"}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** A chart drawn by Sejuk Ops AI (render_chart), with BI-style type switching and CSV export. */
export function CopilotChart({ spec }: { spec: ChartSpec }) {
  const [kind, setKind] = useState<Kind>(spec.type);
  const fmt = formatter(spec.unit);
  const axisFmt = axisFormatter(spec.unit);
  const rows = spec.data.map((d) => ({ label: d.label, ...Object.fromEntries(spec.series.map((_, i) => [`s${i}`, d.values[i] ?? 0])) }));
  const options = alternatives(spec);
  const twoSeries = spec.series.length > 1;

  const tooltip = (
    <Tooltip
      cursor={kind === "bar" || kind === "horizontal_bar" ? BAR_CURSOR : { stroke: "var(--border)" }}
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        const point = payload[0]!.payload as { label: string };
        return (
          <TooltipCard
            title={String(label ?? point.label)}
            rows={spec.series.map((name, i) => ({
              key: name,
              label: name,
              value: fmt(Number((point as Record<string, unknown>)[`s${i}`] ?? 0)),
              color: kind === "pie" ? undefined : SERIES_COLORS[i],
              shape: kind === "line" || kind === "area" ? "line" : "square",
            }))}
          />
        );
      }}
    />
  );
  const legend = twoSeries ? <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} /> : null;
  const height = kind === "horizontal_bar" ? Math.min(420, Math.max(150, rows.length * 30 + 30)) : kind === "pie" ? 240 : 220;

  return (
    <motion.figure
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="bg-card overflow-hidden rounded-xl border shadow-xs dark:border-white/10 dark:bg-white/[0.03]"
    >
      <figcaption className="flex items-start justify-between gap-2 border-b px-3 py-2.5 dark:border-white/8">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{spec.title}</p>
          {spec.subtitle && <p className="text-muted-foreground truncate text-[11px]">{spec.subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(spec)}
          className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors"
          title="Download the data as CSV"
        >
          <Download className="size-3" /> CSV
        </button>
      </figcaption>

      <div className="px-2 pt-3 pb-1" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {kind === "horizontal_bar" ? (
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={axisFmt} />
              <YAxis type="category" dataKey="label" tick={<CategoryTick maxChars={14} />} axisLine={false} tickLine={false} width={96} interval={0} />
              {tooltip}
              {legend}
              {spec.series.map((name, i) => (
                <Bar key={name} dataKey={`s${i}`} name={name} fill={SERIES_COLORS[i]} radius={[0, 4, 4, 0]} maxBarSize={18} animationDuration={700}>
                  {!twoSeries && (
                    <LabelList
                      dataKey={`s${i}`}
                      position="right"
                      formatter={(v: unknown) => fmt(Number(v))}
                      style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
                    />
                  )}
                </Bar>
              ))}
            </BarChart>
          ) : kind === "bar" ? (
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={axisFmt} />
              {tooltip}
              {legend}
              {spec.series.map((name, i) => (
                <Bar key={name} dataKey={`s${i}`} name={name} fill={SERIES_COLORS[i]} radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={700} />
              ))}
            </BarChart>
          ) : kind === "line" || kind === "area" ? (
            kind === "area" ? (
              <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={axisFmt} />
                {tooltip}
                {legend}
                {spec.series.map((name, i) => (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={`s${i}`}
                    name={name}
                    stroke={SERIES_COLORS[i]}
                    fill={SERIES_COLORS[i]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                    animationDuration={800}
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={axisFmt} />
                {tooltip}
                {legend}
                {spec.series.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={`s${i}`}
                    name={name}
                    stroke={SERIES_COLORS[i]}
                    strokeWidth={2.25}
                    dot={{ r: 3, strokeWidth: 0, fill: SERIES_COLORS[i] }}
                    activeDot={{ r: 5 }}
                    animationDuration={800}
                  />
                ))}
              </LineChart>
            )
          ) : (
            <PieChart>
              {tooltip}
              <Pie
                data={rows}
                dataKey="s0"
                nameKey="label"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
                animationDuration={800}
              >
                {rows.map((r, i) => (
                  <Cell key={r.label} fill={CATEGORICAL[i % CATEGORICAL.length]} />
                ))}
              </Pie>
              <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {options.length > 1 && (
        <div className="flex flex-wrap gap-1 border-t px-2 py-1.5 dark:border-white/8" role="group" aria-label="Chart type">
          {options.map((k) => {
            const { label, icon: Icon } = KIND_META[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors",
                  kind === k ? "bg-gradient-ai text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3" /> {label}
              </button>
            );
          })}
        </div>
      )}

      <SrTable caption={spec.title} columns={["", ...spec.series]} rows={spec.data.map((d) => [d.label, ...d.values.map(fmt)])} />
    </motion.figure>
  );
}
