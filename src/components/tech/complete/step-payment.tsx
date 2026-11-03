"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Camera, CreditCard, Loader2, RefreshCw, Sparkles, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/shared/form-field";
import { EASE } from "@/components/motion";
import { formatMYR } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/workflow";
import type { PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Chip } from "../chip";
import { PAYMENT_METHODS, parseAmount } from "../lib";
import { MoneyInput, StepError, StepIntro } from "./fields";
import type { ReceiptState } from "./use-receipt";

function AiReceiptResult({
  receipt,
  entered,
  onUseAmount,
}: {
  receipt: ReceiptState;
  entered: number | null;
  onUseAmount: (n: number) => void;
}) {
  if (receipt.ai.status === "idle") return null;
  if (receipt.ai.status === "reading") {
    return (
      <div className="border-primary/20 bg-primary/5 text-primary relative flex items-center gap-2 overflow-hidden rounded-xl border px-3 py-2.5 text-sm font-medium">
        <div className="shimmer absolute inset-0" aria-hidden />
        <Sparkles className="size-4" /> AI is reading the receipt…
      </div>
    );
  }
  const r = receipt.ai.result;
  if (!r?.ok || r.amount === null) {
    return (
      <div className="text-muted-foreground flex items-start gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm">
        <Sparkles className="mt-0.5 size-4 shrink-0" />
        Couldn&apos;t read the amount automatically — please double-check it yourself.
      </div>
    );
  }
  const mismatch = entered !== null && Math.abs(entered - r.amount) >= 0.01;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="space-y-2"
    >
      <div className="border-primary/20 bg-primary/5 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm">
        <Sparkles className="text-primary mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p>
            AI read <span className="font-semibold tabular-nums">{formatMYR(r.amount)}</span> from the receipt
          </p>
          <p className="text-muted-foreground text-xs">
            {[r.merchant, r.date, `${Math.round(r.confidence * 100)}% confidence`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {mismatch && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">Doesn&apos;t match the {formatMYR(entered)} you entered.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 rounded-lg border-amber-500/40 bg-transparent"
            onClick={() => onUseAmount(r.amount!)}
          >
            Use {formatMYR(r.amount)}
          </Button>
        </div>
      )}
    </motion.div>
  );
}

export function StepPayment({
  enabled,
  onEnabledChange,
  method,
  onMethodChange,
  amount,
  onAmountChange,
  finalAmount,
  receipt,
  onReceipt,
  onClearReceipt,
  error,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  method: PaymentMethod | null;
  onMethodChange: (m: PaymentMethod) => void;
  /** null = follows the final amount */
  amount: string | null;
  onAmountChange: (v: string | null) => void;
  finalAmount: number;
  receipt: ReceiptState;
  onReceipt: (file: File) => void;
  onClearReceipt: () => void;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = amount ?? finalAmount.toFixed(2);
  const entered = parseAmount(shown);

  return (
    <div className="space-y-5">
      <StepIntro icon={CreditCard} title="Payment" description="Optional — record what the customer paid you on site." />

      <div
        onClick={() => onEnabledChange(!enabled)}
        className={cn(
          "flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors",
          enabled ? "border-primary/40 bg-primary/5" : "bg-card",
        )}
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <Wallet className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span id="record-payment-label" className="block text-sm font-semibold">
            Record payment received
          </span>
          <span className="text-muted-foreground block text-xs">Amount, method and receipt photo</span>
        </span>
        <Switch
          aria-labelledby="record-payment-label"
          checked={enabled}
          onCheckedChange={(v) => onEnabledChange(v)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            key="payment-fields"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-5 pt-1 pb-1">
              <FormField label="Payment method" required>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <Chip
                      key={m}
                      selected={method === m}
                      onClick={() => onMethodChange(m)}
                      className={cn("rounded-xl px-3 leading-tight", m === "unpaid" && "col-span-2")}
                    >
                      {PAYMENT_METHOD_LABELS[m]}
                    </Chip>
                  ))}
                </div>
              </FormField>

              {method !== "unpaid" && (
                <FormField
                  label="Amount received"
                  htmlFor="payment-amount"
                  required
                  aside={
                    amount !== null && entered !== finalAmount ? (
                      <button
                        type="button"
                        className="text-primary min-h-8 text-xs font-medium"
                        onClick={() => onAmountChange(null)}
                      >
                        Use final {formatMYR(finalAmount)}
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-xs">Defaults to final amount</span>
                    )
                  }
                >
                  <MoneyInput
                    id="payment-amount"
                    value={shown}
                    onChange={(e) => onAmountChange(e.target.value.replace(/[^\d.]/g, ""))}
                  />
                </FormField>
              )}

              {method !== "unpaid" && (
                <FormField label="Receipt photo" hint="Optional — AI checks the amount for you.">
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onReceipt(f);
                      e.target.value = "";
                    }}
                  />
                  {receipt.status === "idle" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => inputRef.current?.click()}
                      className="h-14 w-full gap-2 rounded-xl border-dashed text-sm"
                    >
                      <Camera className="size-5" /> Snap receipt
                    </Button>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border p-2">
                      <div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-lg">
                        {receipt.previewUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={receipt.previewUrl} alt="Receipt" className="size-full object-cover" />
                        )}
                        {receipt.status === "uploading" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Loader2 className="size-5 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium">
                          {receipt.status === "uploading"
                            ? "Uploading receipt…"
                            : receipt.status === "error"
                              ? "Upload failed"
                              : "Receipt attached"}
                        </p>
                        {receipt.error && <p className="text-destructive truncate text-xs">{receipt.error}</p>}
                      </div>
                      {receipt.status !== "uploading" && (
                        <div className="flex">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            aria-label="Retake receipt"
                            onClick={() => inputRef.current?.click()}
                          >
                            <RefreshCw className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive size-11"
                            aria-label="Remove receipt"
                            onClick={onClearReceipt}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </FormField>
              )}

              {method !== "unpaid" && (
                <AiReceiptResult receipt={receipt} entered={entered} onUseAmount={(n) => onAmountChange(n.toFixed(2))} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!enabled && (
        <p className="text-muted-foreground text-center text-xs">Skip this step if the office collects payment separately.</p>
      )}

      <StepError message={error} />
    </div>
  );
}
