"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, FileCheck2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CountUp, EASE } from "@/components/motion";
import { WhatsAppButton } from "@/components/orders/whatsapp-button";
import { formatDateTime, formatMYR } from "@/lib/format";
import { jobDoneMessage, whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { CompletionOutcome, WizardOrder } from "./types";

const money = (n: number) => formatMYR(n);

function AnimatedCheck() {
  return (
    <div className="relative">
      <motion.span
        className="bg-emerald-500/15 absolute inset-0 rounded-full"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1.35, 1.2], opacity: [0, 0.8, 0] }}
        transition={{ duration: 1.2, ease: EASE, delay: 0.35 }}
      />
      <svg viewBox="0 0 96 96" className="relative size-24" aria-hidden>
        <motion.circle
          cx="48"
          cy="48"
          r="42"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-emerald-500"
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
          className="stroke-emerald-500"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.5 }}
        />
      </svg>
    </div>
  );
}

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
      className="flex flex-col items-center pt-6 text-center"
    >
      <AnimatedCheck />
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

        <div className="bg-card rounded-2xl border p-5 shadow-xs">
          <p className="text-muted-foreground text-xs font-medium">Final amount</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">
            {fresh ? <CountUp value={outcome.finalAmount} format={money} /> : formatMYR(outcome.finalAmount)}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Marked Job Done at {formatDateTime(outcome.completedAt)} · manager notified for review
          </p>
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
