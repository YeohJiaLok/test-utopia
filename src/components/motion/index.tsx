"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useInView, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

/** Shared easing — a calm "enterprise" ease-out. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

export function FadeIn({
  delay = 0,
  y = 10,
  className,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      className={className}
      {...props}
    />
  );
}

/** Container that staggers its <StaggerItem> children into view. */
export function Stagger({
  className,
  delay = 0,
  step = 0.05,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number; step?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: step, delayChildren: delay } } }}
      className={className}
      {...props}
    />
  );
}

export function StaggerItem({ className, ...props }: HTMLMotionProps<"div">) {
  return <motion.div variants={fadeUp} className={className} {...props} />;
}

/** Animated number that counts up when it scrolls into view. */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-MY"),
  duration = 1.1,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const last = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView) return;
    if (reduce) {
      node.textContent = format(value);
      last.current = value;
      return;
    }
    const controls = animate(last.current, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => {
        node.textContent = format(v);
      },
    });
    last.current = value;
    return () => controls.stop();
  }, [value, inView, reduce, duration, format]);

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {format(0)}
    </span>
  );
}

/** Route-level enter animation (wrap page content). */
export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
