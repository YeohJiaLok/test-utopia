"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EASE } from "@/components/motion";
import type { PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { completeJobAction } from "@/app/(app)/tech/actions";
import { BottomBar, BottomBarSpacer, useHydrated } from "../bottom-bar";
import { parseAmount, round2 } from "../lib";
import { StepCharges } from "./step-charges";
import { StepMedia } from "./step-media";
import { StepPayment } from "./step-payment";
import { StepReview } from "./step-review";
import { StepWork } from "./step-work";
import { SuccessScreen } from "./success-screen";
import {
  EMPTY_DRAFT,
  STEPS,
  clearDraft,
  hasDraftContent,
  loadDraft,
  saveDraft,
  type CompletionOutcome,
  type Draft,
  type ExistingMedia,
  type ExistingReceipt,
  type WizardOrder,
} from "./types";
import { useMediaUploads } from "./use-media-uploads";
import { useReceipt } from "./use-receipt";

export interface CompleteWizardProps {
  order: WizardOrder;
  technicianName: string;
  userId: string;
  initialMedia: ExistingMedia[];
  initialReceipt: ExistingReceipt | null;
  /** Set when the job is already Job Done / Reviewed / Closed. */
  completed: CompletionOutcome | null;
}

const slide = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
};

/**
 * Module 2 service job form as a five-step wizard. Rendered only after hydration so the
 * localStorage draft can seed state without a server/client mismatch.
 */
export function CompleteWizard(props: CompleteWizardProps) {
  const hydrated = useHydrated();
  if (!hydrated) return <WizardSkeleton />;
  return <Wizard {...props} />;
}

function WizardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 w-32 rounded-full" />
        ))}
      </div>
    </div>
  );
}

function Wizard({ order, technicianName, userId, initialMedia, initialReceipt, completed }: CompleteWizardProps) {
  const [restored] = useState(() => (completed ? null : loadDraft(order.id)));
  const [draft, setDraft] = useState<Draft>(() => restored ?? EMPTY_DRAFT);
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CompletionOutcome | null>(null);
  const [submitting, startSubmit] = useTransition();

  const media = useMediaUploads({ orderId: order.id, userId, initial: initialMedia });
  const { receipt, capture, clear } = useReceipt({ orderId: order.id, userId, initial: initialReceipt });

  const step = draft.step;
  const extra = parseAmount(draft.extraCharges) ?? 0;
  const finalAmount = round2(order.quotedPrice + extra);
  const paymentAmount = draft.paymentAmount === null ? finalAmount : parseAmount(draft.paymentAmount);
  const done = outcome ?? completed;

  useEffect(() => {
    if (completed) clearDraft(order.id);
    else if (restored && hasDraftContent(restored)) {
      toast.info("Draft restored", { id: `draft-${order.id}`, description: "Picked up where you left off." });
    }
  }, [completed, restored, order.id]);

  useEffect(() => {
    if (!done) saveDraft(order.id, draft);
  }, [draft, done, order.id]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  }

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1);
    setError(null);
    setDraft((d) => ({ ...d, step: next }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validate(s: number): string | null {
    switch (s) {
      case 0:
        return draft.workDone.trim().length < 3 ? "Describe the work done — tap a quick-add chip or type a few words." : null;
      case 1: {
        const v = parseAmount(draft.extraCharges);
        if (v === null) return "Enter a valid amount, e.g. 50 or 49.90.";
        if (v > 100000) return "That extra charge looks too high — please check it.";
        return null;
      }
      case 2:
        if (media.busy) return "Hold on — files are still uploading.";
        if (media.failed) return "Retry or remove the failed upload before continuing.";
        return null;
      case 3:
        if (!draft.paymentEnabled) return null;
        if (!draft.paymentMethod) return "Choose how the customer paid.";
        if (draft.paymentMethod !== "unpaid" && (paymentAmount === null || paymentAmount > 100000))
          return "Enter a valid amount received.";
        if (receipt.status === "uploading") return "Hold on — the receipt is still uploading.";
        return null;
      case 4:
        if (extra > 0 && draft.remarks.trim() === "") return "Add a remark explaining the extra charges.";
        return null;
      default:
        return null;
    }
  }

  function next() {
    const err = validate(step);
    if (err) {
      setError(err);
      navigator.vibrate?.([20, 40, 20]);
      return;
    }
    goTo(step + 1);
  }

  function submit() {
    for (let s = 0; s < STEPS.length; s++) {
      const err = validate(s);
      if (err) {
        if (s !== step) goTo(s);
        setError(err);
        return;
      }
    }
    const method = draft.paymentMethod as PaymentMethod;
    const payment = draft.paymentEnabled
      ? {
          method,
          amount: method === "unpaid" ? 0 : (paymentAmount ?? 0),
          receiptPath: method !== "unpaid" && receipt.status === "done" ? (receipt.path ?? null) : null,
        }
      : null;

    startSubmit(async () => {
      const res = await completeJobAction({
        orderId: order.id,
        workDone: draft.workDone,
        extraCharges: extra,
        remarks: draft.remarks,
        payment,
      });
      if (!res.ok) {
        setError(res.error);
        toast.error("Couldn't complete the job", { description: res.error });
        return;
      }
      clearDraft(order.id);
      navigator.vibrate?.(30);
      window.scrollTo({ top: 0 });
      setOutcome(res.data);
    });
  }

  if (done) {
    return <SuccessScreen order={order} outcome={done} technicianName={technicianName} fresh={!!outcome} />;
  }

  const last = step === STEPS.length - 1;
  const progress = (step + 1) / STEPS.length;

  return (
    <div>
      <div className="bg-muted/85 sticky top-14 z-20 -mx-4 px-4 pt-1 pb-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Link
            href={`/tech/jobs/${order.id}`}
            aria-label="Close and return to job"
            className="hover:bg-background -ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl"
          >
            <X className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Complete job</p>
            <p className="text-muted-foreground truncate font-mono text-xs">{order.orderNo}</p>
          </div>
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <div
          className="bg-border mt-2 h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label="Form progress"
        >
          <motion.div
            className="bg-gradient-brand h-full origin-left rounded-full"
            initial={false}
            animate={{ scaleX: progress }}
            transition={{ duration: 0.45, ease: EASE }}
          />
        </div>
        <ol className="mt-2 grid grid-cols-5 gap-1">
          {STEPS.map((s, i) => {
            const reachable = i < step;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => goTo(i)}
                  className={cn(
                    "flex w-full items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors",
                    i === step ? "text-primary" : reachable ? "text-foreground/70 hover:text-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {reachable && <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />}
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="overflow-x-clip pt-3">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.24, ease: EASE }}
          >
            {step === 0 && (
              <StepWork
                orderNo={order.orderNo}
                serviceName={order.serviceName}
                value={draft.workDone}
                onChange={(v) => update("workDone", v)}
                error={error}
              />
            )}
            {step === 1 && (
              <StepCharges
                quoted={order.quotedPrice}
                extra={draft.extraCharges}
                onExtraChange={(v) => update("extraCharges", v)}
                finalAmount={finalAmount}
                error={error}
              />
            )}
            {step === 2 && <StepMedia media={media} error={error} />}
            {step === 3 && (
              <StepPayment
                enabled={draft.paymentEnabled}
                onEnabledChange={(v) => update("paymentEnabled", v)}
                method={draft.paymentMethod}
                onMethodChange={(m) => update("paymentMethod", m)}
                amount={draft.paymentAmount}
                onAmountChange={(v) => update("paymentAmount", v)}
                finalAmount={finalAmount}
                receipt={receipt}
                onReceipt={(f) => void capture(f)}
                onClearReceipt={() => void clear()}
                error={error}
              />
            )}
            {step === 4 && (
              <StepReview
                orderNo={order.orderNo}
                workDone={draft.workDone}
                quoted={order.quotedPrice}
                extra={extra}
                finalAmount={finalAmount}
                media={media.done}
                payment={
                  draft.paymentEnabled && draft.paymentMethod
                    ? {
                        method: draft.paymentMethod,
                        amount: draft.paymentMethod === "unpaid" ? 0 : (paymentAmount ?? 0),
                        receipt: draft.paymentMethod !== "unpaid" && receipt.status === "done",
                      }
                    : null
                }
                remarks={draft.remarks}
                onRemarksChange={(v) => update("remarks", v)}
                technicianName={technicianName}
                onEdit={goTo}
                error={error}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomBarSpacer />
      <BottomBar>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl px-4"
            disabled={step === 0 || submitting}
            onClick={() => goTo(step - 1)}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          {last ? (
            <Button type="button" className="h-12 flex-1 rounded-xl text-[15px]" disabled={submitting} onClick={submit}>
              {submitting ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
              {submitting ? "Submitting…" : "Submit · Job Done"}
            </Button>
          ) : (
            <Button
              type="button"
              className="h-12 flex-1 rounded-xl text-[15px]"
              disabled={step === 2 && media.busy}
              onClick={next}
            >
              {step === 2 && media.busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  Next: {STEPS[step + 1]!.label} <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </BottomBar>
    </div>
  );
}
