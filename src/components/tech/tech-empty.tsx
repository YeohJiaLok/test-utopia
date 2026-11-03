"use client";

import { motion } from "motion/react";
import { CalendarDays, CheckCircle2, Coffee, History, type LucideIcon } from "lucide-react";
import { EASE } from "@/components/motion";
import { cn } from "@/lib/utils";

/** Icons are resolved here (client side) so server pages can pick one by name. */
const ICONS = {
  coffee: Coffee,
  calendar: CalendarDays,
  check: CheckCircle2,
  history: History,
} satisfies Record<string, LucideIcon>;

export type TechEmptyIcon = keyof typeof ICONS;

/** Friendly empty state for technician screens: tinted icon medallion with a gentle float. */
export function TechEmpty({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: TechEmptyIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const Icon = ICONS[icon];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={cn("bg-card/60 flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center", className)}
    >
      <div className="relative mb-4">
        <div className="bg-primary/10 absolute inset-0 scale-150 rounded-full blur-xl" aria-hidden />
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          className="bg-accent text-primary ring-primary/15 relative flex size-14 items-center justify-center rounded-2xl ring-1"
        >
          <Icon className="size-6" strokeWidth={1.8} />
        </motion.div>
      </div>
      <p className="text-[15px] font-semibold">{title}</p>
      {description && <p className="text-muted-foreground mt-1 max-w-[18rem] text-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
