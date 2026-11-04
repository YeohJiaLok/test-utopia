"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, RotateCcw, X } from "lucide-react";
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
import { StepRail, SummaryPanel } from "./summary-panel";
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
  /** Set when the manager sent the job back: their note, and the previous submission to edit. */
  rework?: { note: string | null; by: string | null; previous: Draft } | null;
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
      <div className="grid grid-cols-5 gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-1.5 rounded-full" />
        ))}
      </div>
      <div className="flex items-start gap-3 pt-2">
        <Skeleton className="size-11 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
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

function Wizard({ order, technicianName, userId, initialMedia, initialReceipt, completed, rework }: CompleteWizardProps) {
  const [restored] = useState(() => (completed ? null : loadDraft(order.id)));
  // Rework: start from what was submitted last time, so only the fix needs changing.
  const [draft, setDraft] = useState<Draft>(() => restored ?? rework?.previous ?? EMPTY_DRAFT);
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CompletionOutcome | null>(null);
  const [submitting, startSubmit] = useTransition();

  const media = useMediaUploads({
    orderId: order.id,
    userId,
    initial: initialMedia,
  });
  const { receipt, capture, clear } = useReceipt({
    orderId: order.id,
    userId,
    initial: initialReceipt,
  });

  const step = draft.step;
  const extra = parseAmount(draft.extraCharges) ?? 0;
  const finalAmount = round2(order.quotedPrice + extra);
  const paymentAmount = draft.paymentAmount === null ? finalAmount : parseAmount(draft.paymentAmount);
  const done = outcome ?? completed;

  useEffect(() => {
    if (completed) clearDraft(order.id);
    else if (restored && hasDraftContent(restored)) {
      toast.info("Draft restored", {
        id: `draft-${order.id}`,
        description: "Picked up where you left off.",
      });
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
    return <SuccessScreen order={order} outcome={done} technicianName={technicianName} fresh={!!outcome} resubmitted={!!outcome && !!rework} />;
  }

  const last = step === STEPS.length - 1;

  const actions = (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-12 rounded-xl px-4"
        disabled={step === 0 || submitting}
        onClick={() => goTo(step - 1)}
        aria-label="Previous step"
      >
        <ArrowLeft className="size-4" />
        <span className="max-[359px]:sr-only">Back</span>
      </Button>
      {last ? (
        <Button
          type="button"
          className="bg-gradient-brand shadow-brand/30 h-12 flex-1 rounded-xl text-[15px] font-semibold text-white shadow-lg"
          disabled={submitting}
          onClick={submit}
        >
          {submitting ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
          {submitting ? "Submitting…" : "Submit · Job Done"}
        </Button>
      ) : (
        <Button
          type="button"
          className="h-12 flex-1 rounded-xl text-[15px] font-semibold"
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
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <div className="bg-background/85 sticky top-14 z-20 -mx-4 border-b px-4 pt-1.5 pb-2.5 backdrop-blur-xl lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-0 lg:backdrop-blur-none">
          <div className="flex items-center gap-2">
            <Link
              href={`/tech/jobs/${order.id}`}
              aria-label="Close and return to job"
              className="hover:bg-muted active:bg-muted -ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors"
            >
              <X className="size-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{rework ? "Fix & resubmit" : "Complete job"}</p>
              <p className="text-muted-foreground truncate font-mono text-xs">
                {order.orderNo} · {order.customerName}
              </p>
            </div>
            <span className="bg-primary/10 text-primary inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold tabular-nums">
              {step + 1}/{STEPS.length}
            </span>
          </div>
          <ol className="mt-2 grid grid-cols-5 gap-1.5 lg:hidden" aria-label="Form progress">
            {STEPS.map((s, i) => {
              const reachable = i < step;
              const current = i === step;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => goTo(i)}
                    aria-current={current ? "step" : undefined}
                    aria-label={`${s.label}${reachable ? " (done, tap to edit)" : current ? " (current step)" : ""}`}
                    className="group flex w-full flex-col items-stretch gap-1.5 pt-1 pb-0.5 disabled:cursor-default"
                  >
                    <span className="bg-border relative h-1.5 overflow-hidden rounded-full">
                      <motion.span
                        className="bg-gradient-brand absolute inset-0 origin-left rounded-full"
                        initial={false}
                        animate={{ scaleX: i <= step ? 1 : 0 }}
                        transition={{
                          duration: 0.4,
                          ease: EASE,
                          delay: i === step ? 0.1 : 0,
                        }}
                      />
                    </span>
                    <span
                      className={cn(
                        "flex items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                        current
                          ? "text-primary font-semibold"
                          : reachable
                            ? "text-foreground/75 group-hover:text-foreground"
                            : "text-muted-foreground/70",
                      )}
                    >
                      {reachable && <Check className="text-primary size-3 shrink-0" strokeWidth={3} />}
                      <span className="truncate">{s.label}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {rework && step === 0 && (
          <div className="mt-4 flex gap-3 rounded-2xl border border-orange-500/25 bg-orange-500/8 p-4 text-sm" role="note">
            <RotateCcw className="mt-0.5 size-5 shrink-0 text-orange-600 dark:text-orange-400" />
            <div className="min-w-0">
              <p className="font-semibold text-orange-700 dark:text-orange-300">Sent back{rework.by ? ` by ${rework.by}` : ""}</p>
              <p className="text-foreground/85 mt-0.5 break-words">{rework.note ?? "The manager asked for this job to be redone."}</p>
              <p className="text-muted-foreground mt-1.5 text-xs">Your last submission is filled in. Change what was asked, add photos if needed, then resubmit.</p>
            </div>
          </div>
        )}

        <div className="overflow-x-clip pt-5 lg:mt-4 lg:rounded-2xl lg:border lg:bg-card lg:p-8 lg:shadow-xs">
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

        <div className="mt-4 hidden lg:block">{actions}</div>
      </div>

      <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block">
        <StepRail step={step} onGoTo={goTo} />
        <SummaryPanel
          order={order}
          workLines={draft.workDone.split("\n").filter((l) => l.trim()).length}
          extra={extra}
          finalAmount={finalAmount}
          mediaCount={media.done.length}
          mediaBusy={media.busy}
          payment={
            draft.paymentEnabled
              ? {
                  method: draft.paymentMethod,
                  amount: draft.paymentMethod === "unpaid" ? 0 : paymentAmount,
                }
              : null
          }
        />
      </aside>

      <BottomBarSpacer />
      <BottomBar>{actions}</BottomBar>
    </div>
  );
}
