"use client";

import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Marks a form field that was pre-filled by AI document import, with the model's confidence. */
export function AiChip({ confidence, className }: { confidence: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const low = pct < 70;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8, y: 2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      title={low ? "Low confidence — please double-check this value" : "Filled from the imported document"}
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset tabular",
        low
          ? "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300"
          : "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300",
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      AI · {pct}%
    </motion.span>
  );
}

/** Input / textarea / select highlight for AI-filled values (fades when cleared). */
export function aiFieldClass(active: boolean) {
  return cn(
    "transition-[background-color,border-color,box-shadow] duration-500",
    active && "border-violet-400/60 bg-violet-500/[0.04] dark:border-violet-400/40 dark:bg-violet-500/[0.07]",
  );
}
