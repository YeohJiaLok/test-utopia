import type { WorkloadStat } from "@/lib/types";

/** z-score thresholds against the team mean (workload_stats). */
export const OVERLOAD_Z = 1.5;
export const CRITICAL_Z = 2;
export const UNDERLOAD_Z = -1.5;

export type LoadLevel = "critical" | "overloaded" | "balanced" | "underloaded";

export function loadLevel(w: Pick<WorkloadStat, "z_score">): LoadLevel {
  if (w.z_score >= CRITICAL_Z) return "critical";
  if (w.z_score >= OVERLOAD_Z) return "overloaded";
  if (w.z_score <= UNDERLOAD_Z) return "underloaded";
  return "balanced";
}

export const LOAD_META: Record<LoadLevel, { label: string; color: string }> = {
  critical: { label: "Overloaded (≥ 2σ)", color: "var(--destructive)" },
  overloaded: { label: "High load (≥ 1.5σ)", color: "var(--warning)" },
  balanced: { label: "Within range", color: "var(--chart-1)" },
  underloaded: { label: "Spare capacity (≤ −1.5σ)", color: "color-mix(in oklch, var(--chart-1) 40%, transparent)" },
};

export function formatSigma(z: number) {
  return `${z > 0 ? "+" : z < 0 ? "−" : ""}${Math.abs(z).toFixed(1)}σ`;
}
