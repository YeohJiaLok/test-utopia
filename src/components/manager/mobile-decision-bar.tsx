"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ShieldAlert } from "lucide-react";
import { EASE } from "@/components/motion";
import { cn } from "@/lib/utils";

/**
 * Phones/tablets only (< lg): the decision panel sits below the evidence, so a floating bar
 * keeps "Decide" one tap away while the manager reviews. It hides once the panel is on screen.
 * Leaves room on the right for the Ops Copilot launcher.
 */
export function MobileDecisionBar({ targetId, highFlags, label }: { targetId: string; highFlags: number; label: string }) {
  const [targetVisible, setTargetVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setTargetVisible(entry?.isIntersecting ?? false), {
      rootMargin: "0px 0px -20% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);

  const jump = () => {
    const el = document.getElementById(targetId);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => el?.querySelector<HTMLElement>("[role=radiogroup] button, textarea")?.focus({ preventScroll: true }), 450);
  };

  return (
    <AnimatePresence>
      {!targetVisible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="fixed bottom-5 left-4 right-20 z-30 lg:hidden"
        >
          <button
            type="button"
            onClick={jump}
            className={cn(
              "bg-foreground text-background flex h-12 w-full items-center gap-3 rounded-full pr-2 pl-4 text-left shadow-lg ring-1 ring-black/5 transition-transform active:scale-[0.98]",
            )}
          >
            {highFlags > 0 && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                <ShieldAlert className="size-3" aria-hidden /> {highFlags}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
            <span className="bg-background/15 flex size-8 shrink-0 items-center justify-center rounded-full">
              <ArrowDown className="size-4" aria-hidden />
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
