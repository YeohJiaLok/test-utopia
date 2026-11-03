"use client";

import { cn } from "@/lib/utils";

/**
 * Shared chart chrome. Colours come from the CSS tokens (--chart-1..5) so light and dark
 * themes each use their own validated steps. Categorical order below is the validated
 * sequence (adjacent pairs pass CVD + normal-vision separation): 1, 3, 5, 4, 2.
 */
export const CATEGORICAL = ["var(--chart-1)", "var(--chart-3)", "var(--chart-5)", "var(--chart-4)", "var(--chart-2)"] as const;
export const NEUTRAL = "var(--muted-foreground)";

export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 } as const;
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
    <div className="bg-popover text-popover-foreground min-w-40 rounded-lg border px-3 py-2 text-xs shadow-lg">
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

/** Visually hidden table so every plotted value is reachable without hover (screen readers). */
export function SrTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="sr-only">
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
            {r.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Compact segmented toggle used inside chart cards (metric switchers). */
export function MiniToggle<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-muted inline-flex rounded-md p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-6 rounded-[5px] px-2 text-[11px] font-medium transition-colors",
            value === o.value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Compact ticks for currency axes: RM 0 / RM 800 / RM 1.2K */
export function compactMYR(n: number) {
  if (Math.abs(n) >= 1000) return `RM ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `RM ${Math.round(n)}`;
}
