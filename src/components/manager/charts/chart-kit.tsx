"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Shared chart chrome. Colours come from the CSS tokens (--chart-1..5) so light and dark
 * themes each use their own validated steps. Categorical order below is the validated
 * sequence (adjacent pairs pass CVD + normal-vision separation): 1, 3, 5, 4, 2.
 */
export const CATEGORICAL = ["var(--chart-1)", "var(--chart-3)", "var(--chart-5)", "var(--chart-4)", "var(--chart-2)"] as const;
export const NEUTRAL = "var(--muted-foreground)";

export const AXIS_TICK = {
  fill: "var(--muted-foreground)",
  fontSize: 11,
} as const;
/** Y-axis width that fits compact ticks ("12", "3.6K") without clipping. */
export const Y_AXIS_WIDTH = 36;
export const GRID_STROKE = "var(--border)";
export const BAR_CURSOR = { fill: "var(--muted)", opacity: 0.7 } as const;

export interface TooltipRow {
  key: string;
  label: string;
  value: string;
  color?: string;
  /** "line" for line/area series, "square" for bars/slices */
  shape?: "line" | "square";
}

/** Tooltip body: values lead (strong), series names follow (muted), keyed by a mark-shaped swatch. */
export function TooltipCard({ title, rows, footer }: { title: string; rows: TooltipRow[]; footer?: React.ReactNode }) {
  return (
    <div className="bg-popover/95 text-popover-foreground min-w-40 rounded-lg border px-3 py-2 text-xs shadow-lg ring-1 ring-foreground/5 backdrop-blur-sm">
      <p className="text-muted-foreground mb-1.5 font-medium">{title}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            {r.color && (
              <span
                aria-hidden
                className={cn("shrink-0", r.shape === "line" ? "h-0.5 w-3 rounded-full" : "size-2.5 rounded-[3px]")}
                style={{ background: r.color }}
              />
            )}
            <span className="text-foreground font-semibold tabular-nums">{r.value}</span>
            <span className="text-muted-foreground">{r.label}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="text-muted-foreground mt-1.5 border-t pt-1.5">{footer}</div>}
    </div>
  );
}

/**
 * Visually hidden table so every plotted value is reachable without hover (screen readers).
 * The wrapper (not the table) carries `sr-only`: tables ignore `width: 1px`/`overflow: hidden`,
 * so a bare `table.sr-only` leaks its full width into the page's scrollable overflow on mobile.
 */
export function SrTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={j}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Compact segmented toggle used inside chart cards (metric switchers). Taller on touch screens. */
export function MiniToggle<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const pill = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("bg-muted inline-flex rounded-lg p-0.5", className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "focus-visible:ring-ring/50 relative h-10 flex-1 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 sm:h-7 sm:px-2.5 sm:text-[11px]",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={pill}
                aria-hidden
                className="bg-background ring-foreground/5 absolute inset-0 rounded-md shadow-xs ring-1"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Compact ticks for currency axes: RM 0 / RM 800 / RM 1.2K */
export function compactMYR(n: number) {
  if (Math.abs(n) >= 1000) return `RM ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `RM ${Math.round(n)}`;
}

/** Compact ticks for unit-labelled axes: 0 / 800 / 1.2K / 3.6K */
export function compactNumber(n: number) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(Math.round(n));
}

/**
 * Single-line category tick for horizontal bar charts. Recharts wraps long labels onto two
 * lines, which misaligns them with thin bars; this truncates with an ellipsis instead.
 */
export function CategoryTick({
  x,
  y,
  payload,
  maxChars = 14,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: unknown };
  maxChars?: number;
}) {
  const raw = String(payload?.value ?? "");
  const label = raw.length > maxChars ? `${raw.slice(0, maxChars - 1).trimEnd()}…` : raw;
  return (
    <text x={Number(x)} y={Number(y)} dx={-6} dy={4} textAnchor="end" fill={AXIS_TICK.fill} fontSize={AXIS_TICK.fontSize}>
      <title>{raw}</title>
      {label}
    </text>
  );
}
