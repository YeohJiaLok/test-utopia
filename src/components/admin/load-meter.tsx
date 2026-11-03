"use client";

import { motion } from "motion/react";
import { EASE } from "@/components/motion";
import { cn } from "@/lib/utils";

/** Open jobs at which a technician is considered fully booked for dispatch purposes. */
export const LOAD_CAPACITY = 4;

export type LoadLevel = "free" | "light" | "busy" | "full";

export function loadLevel(openJobs: number): LoadLevel {
  if (openJobs <= 0) return "free";
  if (openJobs <= 2) return "light";
  if (openJobs < LOAD_CAPACITY) return "busy";
  return "full";
}

export const LOAD_META: Record<LoadLevel, { label: string; bar: string; text: string; dot: string }> = {
  free: { label: "Available", bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  light: { label: "Light load", bar: "bg-sky-500", text: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  busy: { label: "Busy", bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  full: { label: "Fully booked", bar: "bg-red-500", text: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
};

/** Segmented meter: one segment per open-job slot up to LOAD_CAPACITY. */
export function LoadMeter({ openJobs, className, delay = 0 }: { openJobs: number; className?: string; delay?: number }) {
  const level = loadLevel(openJobs);
  const filled = Math.min(openJobs, LOAD_CAPACITY);
  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={LOAD_CAPACITY}
      aria-valuenow={filled}
      aria-label={`${openJobs} open job${openJobs === 1 ? "" : "s"} · ${LOAD_META[level].label}`}
    >
      {Array.from({ length: LOAD_CAPACITY }, (_, i) => (
        <span key={i} className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full">
          {i < filled && (
            <motion.span
              className={cn("absolute inset-0 origin-left rounded-full", LOAD_META[level].bar)}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.35, ease: EASE, delay: delay + i * 0.06 }}
            />
          )}
        </span>
      ))}
    </div>
  );
}
