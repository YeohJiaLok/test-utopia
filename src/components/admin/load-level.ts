/**
 * Pure workload helpers (no "use client"): safe to import from server components
 * as well as from the client-side LoadMeter / picker / strip.
 */

/** Open jobs at which a technician is considered fully booked for dispatch purposes. */
export const LOAD_CAPACITY = 4;

export type LoadLevel = "free" | "light" | "busy" | "full";

export function loadLevel(openJobs: number): LoadLevel {
  if (openJobs <= 0) return "free";
  if (openJobs <= 2) return "light";
  if (openJobs < LOAD_CAPACITY) return "busy";
  return "full";
}

export const LOAD_META: Record<LoadLevel, { label: string; bar: string; text: string; dot: string; soft: string }> = {
  free: {
    label: "Available",
    bar: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    soft: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
  },
  light: {
    label: "Light load",
    bar: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
    soft: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300",
  },
  busy: {
    label: "Busy",
    bar: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    soft: "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  },
  full: {
    label: "Fully booked",
    bar: "bg-red-500",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
    soft: "bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-300",
  },
};
