"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { EASE } from "@/components/motion";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/** true after hydration; false during SSR and the hydration pass. */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Sticky action bar that floats just above the technician bottom tabs (safe-area aware).
 * Portalled to <body> so page transitions (transforms) never break fixed positioning.
 */
export function BottomBar({ children, className }: { children: React.ReactNode; className?: string }) {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return createPortal(
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE, delay: 0.1 }}
      className="pointer-events-none fixed inset-x-0 z-40 px-3"
      style={{ bottom: "calc(4.25rem + max(env(safe-area-inset-bottom), 0.75rem))" }}
    >
      <div
        className={cn(
          "bg-background/92 pointer-events-auto mx-auto max-w-lg rounded-2xl border p-2 shadow-lg shadow-slate-900/8 backdrop-blur-md",
          className,
        )}
      >
        {children}
      </div>
    </motion.div>,
    document.body,
  );
}

/** Reserves room at the end of the page so content is never hidden behind the bar. */
export function BottomBarSpacer() {
  return <div aria-hidden className="h-20" />;
}
