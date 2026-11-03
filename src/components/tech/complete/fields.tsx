"use client";

import { useSyncExternalStore } from "react";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TIMEZONE } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StepIntro({ icon: Icon, title, description }: { icon?: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <span className="bg-accent text-primary ring-primary/15 flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1">
          <Icon className="size-5" />
        </span>
      )}
      <div className="min-w-0">
        <h2 className="text-xl leading-tight font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

/** Ringgit amount input with a fixed "RM" prefix and a numeric keypad on mobile. */
export function MoneyInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type" | "inputMode">) {
  return (
    <div className="relative">
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base font-medium">
        RM
      </span>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn("h-12 rounded-xl pl-12 text-lg font-medium tabular-nums md:text-lg", className)}
        {...props}
      />
    </div>
  );
}

export function ReadOnlyField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="bg-muted/60 rounded-xl border border-dashed px-3.5 py-2.5">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</p>
      <p className={cn("mt-0.5 text-base font-semibold tabular-nums", mono && "font-mono text-[15px]")}>{value}</p>
    </div>
  );
}

/** Animated inline validation message (shakes in so it's noticed on a small screen). */
export function StepError({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          key={message}
          role="alert"
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="text-destructive bg-destructive/8 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-medium"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

const subscribeClock = (cb: () => void) => {
  const t = window.setInterval(cb, 1000);
  return () => window.clearInterval(t);
};
const clockSnapshot = () => Math.floor(Date.now() / 1000);
const clockServerSnapshot = () => 0;

/** Ticking Malaysia-time clock (read-only timestamp on the review step). */
export function LiveClock({ className }: { className?: string }) {
  const seconds = useSyncExternalStore(subscribeClock, clockSnapshot, clockServerSnapshot);
  return (
    <time className={cn("tabular-nums", className)} suppressHydrationWarning>
      {seconds ? format(new TZDate(seconds * 1000, TIMEZONE), "EEE, d MMM yyyy · h:mm:ss a") : "—"}
    </time>
  );
}
