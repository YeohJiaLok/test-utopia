"use client";

import { motion } from "motion/react";
import { Check, CloudCheck, Loader2 } from "lucide-react";
import { CountUp, EASE } from "@/components/motion";
import { formatMYR } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/workflow";
import type { PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MAX_JOB_MEDIA } from "../lib";
import { STEPS, type WizardOrder } from "./types";

const money = (n: number) => formatMYR(n);

/** Vertical step rail for the desktop completion wizard. */
export function StepRail({ step, onGoTo }: { step: number; onGoTo: (i: number) => void }) {
  return (
    <nav aria-label="Form progress" className="bg-card rounded-2xl border p-3 shadow-xs">
      <ol>
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.key} className="relative">
              {i < STEPS.length - 1 && (
                <span
                  className={cn(
                    "absolute top-10 bottom-0 left-[25px] w-0.5 rounded-full transition-colors duration-500",
                    done ? "bg-primary" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
              <button
                type="button"
                disabled={!done}
                onClick={() => onGoTo(i)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
                  done && "hover:bg-muted/60",
                  current && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    done
                      ? "bg-primary text-primary-foreground"
                      : current
                        ? "bg-background text-primary ring-primary ring-2"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium", current ? "text-primary" : !done && "text-muted-foreground")}>
                    {s.label}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {done ? "Done · tap to edit" : current ? "In progress" : "Up next"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Live summary of the completion form (desktop side panel). */
export function SummaryPanel({
  order,
  workLines,
  extra,
  finalAmount,
  mediaCount,
  mediaBusy,
  payment,
}: {
  order: WizardOrder;
  workLines: number;
  extra: number;
  finalAmount: number;
  mediaCount: number;
  mediaBusy: boolean;
  payment: { method: PaymentMethod | null; amount: number | null } | null;
}) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Customer", value: order.customerName },
    { label: "Service", value: order.serviceName },
    {
      label: "Work items",
      value: workLines ? `${workLines} line${workLines === 1 ? "" : "s"}` : <Muted>Not yet</Muted>,
    },
    {
      label: "Photos & files",
      value: (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          {mediaBusy && <Loader2 className="text-primary size-3.5 animate-spin" />}
          {mediaCount} / {MAX_JOB_MEDIA}
        </span>
      ),
    },
    {
      label: "Payment",
      value:
        payment && payment.method ? (
          <span className="tabular-nums">
            {PAYMENT_METHOD_LABELS[payment.method]}
            {payment.method !== "unpaid" && payment.amount !== null && ` · ${formatMYR(payment.amount)}`}
          </span>
        ) : (
          <Muted>Not recorded</Muted>
        ),
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
      className="bg-card overflow-hidden rounded-2xl border shadow-xs"
    >
      <div className="bg-gradient-brand relative overflow-hidden p-5 text-white">
        <div className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <p className="text-xs font-medium text-white/85">Final amount</p>
        <p className="mt-0.5 text-3xl font-semibold tracking-tight">
          <CountUp value={finalAmount} format={money} duration={0.6} />
        </p>
        <p className="mt-1 text-xs text-white/85 tabular-nums">
          {formatMYR(finalAmount - extra)} quoted + {formatMYR(extra)} extra
        </p>
      </div>
      <dl className="divide-y px-5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-muted-foreground shrink-0">{r.label}</dt>
            <dd className="min-w-0 truncate text-right font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground bg-muted/40 flex items-center gap-1.5 border-t px-5 py-2.5 text-xs">
        <CloudCheck className="text-primary size-3.5" /> Draft saved on this device as you type
      </p>
    </motion.section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground font-normal">{children}</span>;
}
