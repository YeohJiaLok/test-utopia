"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, BellRing, CircleCheck, FileCheck2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CountUp, EASE } from "@/components/motion";
import { WhatsAppButton } from "@/components/orders/whatsapp-button";
import { formatDateTime, formatMYR } from "@/lib/format";
import { jobDoneMessage, whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { CompletionOutcome, WizardOrder } from "./types";

const money = (n: number) => formatMYR(n);

/** Confetti-like burst of brand-tinted dots around the check (skipped for already-completed jobs). */
const BURST = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
  const dist = i % 2 ? 74 : 62;
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    size: i % 3 === 0 ? 8 : 6,
    alt: i % 2 === 1,
  };
});

function AnimatedCheck({ burst }: { burst: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex size-28 items-center justify-center">
      <motion.span
        className="bg-primary/15 absolute inset-0 rounded-full"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1.4, 1.25], opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.2, ease: EASE, delay: 0.35 }}
      />
      <motion.span
        className="bg-accent ring-primary/15 absolute inset-2 rounded-full ring-1"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      />
      {burst &&
        !reduce &&
        BURST.map((p, i) => (
          <motion.span
            key={i}
            aria-hidden
            className={cn("absolute rounded-full", p.alt ? "bg-brand-2" : "bg-brand")}
            style={{ width: p.size, height: p.size }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
            animate={{ x: p.x, y: p.y, scale: [0, 1, 0.6], opacity: [0, 1, 0] }}
            transition={{
              duration: 0.9,
              ease: EASE,
              delay: 0.55 + (i % 4) * 0.03,
            }}
          />
        ))}
      <svg viewBox="0 0 96 96" className="relative size-24" aria-hidden>
        <motion.circle
          cx="48"
          cy="48"
          r="42"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-primary"
          transform="rotate(-90 48 48)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        />
        <motion.path
          d="M30 49.5 L42.5 62 L66 36"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.5 }}
        />
      </svg>
    </div>
  );
}

const NEXT_STEPS = [
  { icon: CircleCheck, text: "Status set to Job Done" },
  { icon: BellRing, text: "Manager notified to review your work" },
] as const;

export function SuccessScreen({
  order,
  outcome,
  technicianName,
  fresh,
}: {
  order: WizardOrder;
  outcome: CompletionOutcome;
  technicianName: string;
  /** true right after submitting; false when opening an already-completed job */
  fresh: boolean;
}) {
  const href =
    outcome.feedback?.deepLink ??
    whatsappLink(
      order.customerPhone,
      jobDoneMessage({
        customerName: order.customerName,
        orderNo: order.orderNo,
        technicianName,
        time: formatDateTime(outcome.completedAt),
      }),
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mx-auto flex max-w-xl flex-col items-center pt-6 text-center lg:pt-12"
    >
      <AnimatedCheck burst={fresh} />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.7 }}
        className="mt-5 w-full space-y-6"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{fresh ? "Job completed!" : "This job is complete"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {order.orderNo} · {order.customerName}
          </p>
        </div>

        <div className="bg-gradient-brand shadow-brand/25 relative overflow-hidden rounded-2xl p-5 text-white shadow-lg">
          <div className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <p className="text-xs font-medium text-white/85">Final amount</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
            {fresh ? <CountUp value={outcome.finalAmount} format={money} /> : formatMYR(outcome.finalAmount)}
          </p>
          <p className="mt-2 text-xs text-white/85">Marked Job Done · {formatDateTime(outcome.completedAt)}</p>
        </div>

        <div className="space-y-2">
          <WhatsAppButton
            href={href}
            notificationId={outcome.feedback?.id}
            className="h-13 w-full rounded-xl text-[15px] shadow-md shadow-emerald-500/20"
          >
            Send feedback request to customer
          </WhatsAppButton>
          <p className="text-muted-foreground text-xs">Opens WhatsApp with the message already written for you.</p>
        </div>

        {fresh && (
          <ul className="bg-card divide-y rounded-2xl border text-left text-sm shadow-xs">
            {NEXT_STEPS.map(({ icon: Icon, text }, i) => (
              <motion.li
                key={text}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease: EASE, delay: 0.9 + i * 0.1 }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="bg-accent text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </span>
                {text}
              </motion.li>
            ))}
          </ul>
        )}

        <div className="space-y-1">
          <Link href="/tech" className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full rounded-xl text-[15px]")}>
            <ArrowLeft className="size-4" /> Back to my jobs
          </Link>
          <Link
            href={`/tech/jobs/${order.id}`}
            className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground h-11 w-full rounded-xl")}
          >
            <FileCheck2 className="size-4" /> View job summary
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
