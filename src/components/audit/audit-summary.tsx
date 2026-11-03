"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Activity, Coins, Gauge, Hash, ShieldAlert, Timer, TriangleAlert, UserCog, Users, type LucideIcon } from "lucide-react";
import { CountUp, EASE, Stagger, StaggerItem } from "@/components/motion";
import type { AuditKpi, VolumeBucket } from "@/app/(app)/audit/_lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  total: Activity,
  orders: Hash,
  actors: Users,
  exceptions: TriangleAlert,
  failures: ShieldAlert,
  latency: Timer,
  tokens: Coins,
  accounts: Users,
  roles: UserCog,
  deactivations: TriangleAlert,
};

function formatter(kpi: AuditKpi) {
  switch (kpi.format) {
    case "percent":
      return (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`;
    case "seconds":
      return (n: number) => `${(n / 1000).toFixed(1)} s`;
    case "compact":
      return (n: number) => new Intl.NumberFormat("en-MY", { notation: "compact", maximumFractionDigits: 1 }).format(n);
    default:
      return (n: number) => Math.round(n).toLocaleString("en-MY");
  }
}

export function AuditKpis({ kpis, rangeLabel, capped }: { kpis: AuditKpi[]; rangeLabel: string; capped: boolean }) {
  return (
    <section aria-label="Summary" className="space-y-2">
      <Stagger className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = ICONS[k.key] ?? Gauge;
          const warn = k.tone === "warning";
          return (
            <StaggerItem key={k.key} className="bg-card relative min-w-0 overflow-hidden rounded-xl border p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-muted-foreground min-w-0 truncate text-xs font-medium">{k.label}</p>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg",
                    warn ? "bg-amber-500/12 text-amber-700 dark:text-amber-300" : "bg-primary/8 text-primary",
                  )}
                  aria-hidden
                >
                  <Icon className="size-3.5" />
                </span>
              </div>
              <p className="mt-1 text-xl font-semibold tracking-tight tabular sm:text-2xl">
                {k.value === null ? "—" : <CountUp value={k.value} format={formatter(k)} />}
              </p>
              <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{k.hint ?? rangeLabel}</p>
            </StaggerItem>
          );
        })}
      </Stagger>
      {capped && (
        <p className="text-muted-foreground text-[11px]">
          Summary figures cover the most recent 10,000 entries in this view; the total count is exact.
        </p>
      )}
    </section>
  );
}

/** Single-series activity histogram (one hue, hover/focus for exact values). */
export function AuditVolume({
  buckets,
  unit,
  noun,
}: {
  buckets: VolumeBucket[];
  unit: "hour" | "day" | "week";
  noun: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const sum = buckets.reduce((s, b) => s + b.count, 0);
  const peak = buckets.reduce<VolumeBucket | null>((p, b) => (!p || b.count > p.count ? b : p), null);
  const active = hover !== null ? buckets[hover] : null;
  if (buckets.length < 2) return null;

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground truncate">
          {active ? (
            <>
              <span className="text-foreground font-medium">{active.label}</span> ·{" "}
              <span className="text-foreground font-semibold tabular">{active.count.toLocaleString("en-MY")}</span> {noun}
            </>
          ) : (
            <>
              Activity per {unit}
              {peak && peak.count > 0 && (
                <>
                  {" "}
                  · peak <span className="text-foreground font-medium">{peak.label}</span>
                </>
              )}
            </>
          )}
        </span>
        <span className="text-muted-foreground shrink-0 tabular">{sum.toLocaleString("en-MY")} total</span>
      </div>
      <div
        className="flex h-12 items-end gap-[2px]"
        role="img"
        aria-label={`${noun} per ${unit}: ${buckets.map((b) => `${b.label} ${b.count}`).join(", ")}`}
        onMouseLeave={() => setHover(null)}
      >
        {buckets.map((b, i) => (
          <div
            key={b.key}
            className="group relative flex h-full min-w-0 flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            title={`${b.label}: ${b.count}`}
          >
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.5, ease: EASE, delay: Math.min(i, 40) * 0.008 }}
              style={{ height: b.count ? `${Math.max(6, (b.count / max) * 100)}%` : "2px", originY: 1 }}
              className={cn(
                "w-full rounded-t-[3px] transition-colors",
                b.count ? "bg-primary/55 group-hover:bg-primary" : "bg-border",
                hover === i && "bg-primary",
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
