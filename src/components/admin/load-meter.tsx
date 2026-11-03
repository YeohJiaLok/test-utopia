"use client";

import { motion } from "motion/react";
import { EASE } from "@/components/motion";
import { cn } from "@/lib/utils";
import { LOAD_CAPACITY, LOAD_META, loadLevel } from "./load-level";

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
