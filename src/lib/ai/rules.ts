/**
 * AI Workflow Supervisor — deterministic rule engine.
 *
 * Pure and dependency-free (type-only imports) so it can run anywhere: the server
 * supervisor, the seed script and unit tests. Every rule is explainable and carries
 * the evidence it fired on; the LLM reviewer only adds judgement on top of these.
 */
import type { AttachmentKind, FlagSeverity, PaymentMethod } from "@/lib/types";

type Numeric = number | string | null | undefined;

export interface RuleInput {
  order: {
    quoted_price: Numeric;
    reschedule_count?: number | null;
    started_at?: string | null;
    completed_at?: string | null;
  };
  completion: {
    quoted_price?: Numeric;
    extra_charges?: Numeric;
    final_amount?: Numeric;
    remarks?: string | null;
    payment_amount?: Numeric;
    payment_method?: PaymentMethod | null;
    completed_at?: string | null;
  } | null;
  attachments: { kind: AttachmentKind }[];
}

export type RuleCode =
  | "AMOUNT_OVER_QUOTE"
  | "NO_MEDIA"
  | "EXTRA_WITHOUT_REMARKS"
  | "PAYMENT_MISMATCH"
  | "PAYMENT_NOT_COLLECTED"
  | "FREQUENT_RESCHEDULE"
  | "SLOW_COMPLETION";

/** Shape matches the `ai_flags` columns (minus order_id / source). */
export interface RuleFlag {
  rule_code: RuleCode;
  severity: FlagSeverity;
  title: string;
  explanation: string;
  recommended_action: string;
  evidence: Record<string, unknown>;
}

export const RULE_THRESHOLDS = {
  overQuoteMedium: 1.25,
  overQuoteHigh: 1.5,
  paymentToleranceMyr: 1,
  paymentMismatchHighRatio: 0.2,
  frequentReschedules: 2,
  slowCompletionHours: 6,
} as const;

export const RULE_CATALOGUE: Record<RuleCode, { title: string; description: string }> = {
  AMOUNT_OVER_QUOTE: {
    title: "Final amount above quotation",
    description: "Final amount exceeds the quoted price by more than 25% (medium) or 50% (high).",
  },
  NO_MEDIA: { title: "No job evidence uploaded", description: "No photo, video or PDF attached to a completed job." },
  EXTRA_WITHOUT_REMARKS: {
    title: "Extra charges without remarks",
    description: "Extra charges were added but the technician left no explanation.",
  },
  PAYMENT_MISMATCH: {
    title: "Payment does not match final amount",
    description: "Recorded payment differs from the final amount by more than RM1 (medium) or 20% (high).",
  },
  PAYMENT_NOT_COLLECTED: {
    title: "Payment not collected",
    description: "Job completed with no payment recorded or payment marked unpaid.",
  },
  FREQUENT_RESCHEDULE: { title: "Frequently rescheduled", description: "Order was rescheduled two or more times." },
  SLOW_COMPLETION: {
    title: "Slow completion",
    description: "More than 6 hours between job start and completion.",
  },
};

const SEVERITY_RANK: Record<FlagSeverity, number> = { low: 1, medium: 2, high: 3 };

function num(value: Numeric): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function rm(n: number) {
  return `RM${n.toFixed(2)}`;
}

function flag(rule_code: RuleCode, severity: FlagSeverity, explanation: string, recommended_action: string, evidence: Record<string, unknown>): RuleFlag {
  return { rule_code, severity, title: RULE_CATALOGUE[rule_code].title, explanation, recommended_action, evidence };
}

/** Run every deterministic rule against one completed order. */
export function evaluateRules(input: RuleInput): RuleFlag[] {
  const flags: RuleFlag[] = [];
  const { order, completion, attachments } = input;

  // Evidence rules apply only once the job has a completion record.
  if (completion) {
    const quoted = num(completion.quoted_price) ?? num(order.quoted_price) ?? 0;
    const extra = num(completion.extra_charges) ?? 0;
    const final = num(completion.final_amount) ?? quoted + extra;

    // AMOUNT_OVER_QUOTE
    if (quoted > 0) {
      const ratio = final / quoted;
      if (ratio > RULE_THRESHOLDS.overQuoteMedium) {
        const severity: FlagSeverity = ratio > RULE_THRESHOLDS.overQuoteHigh ? "high" : "medium";
        flags.push(
          flag(
            "AMOUNT_OVER_QUOTE",
            severity,
            `Final amount ${rm(final)} is ${Math.round((ratio - 1) * 100)}% above the quoted ${rm(quoted)}.`,
            "Confirm the additional work with the technician and that the customer approved the revised price.",
            { quoted_price: quoted, final_amount: final, ratio: round2(ratio) },
          ),
        );
      }
    } else if (final > 0) {
      flags.push(
        flag(
          "AMOUNT_OVER_QUOTE",
          "medium",
          `Customer was charged ${rm(final)} but the order has no quoted price.`,
          "Check how the price was agreed and record a quotation for future jobs.",
          { quoted_price: quoted, final_amount: final, ratio: null },
        ),
      );
    }

    // NO_MEDIA
    const media = attachments.filter((a) => a.kind === "photo" || a.kind === "video" || a.kind === "pdf").length;
    if (media === 0) {
      flags.push(
        flag(
          "NO_MEDIA",
          "high",
          "The job was marked done without any photo, video or PDF evidence.",
          "Ask the technician to upload before/after photos before approving the job.",
          { media_count: 0, attachments_total: attachments.length },
        ),
      );
    }

    // EXTRA_WITHOUT_REMARKS
    const remarks = (completion.remarks ?? "").trim();
    if (extra > 0 && remarks.length === 0) {
      flags.push(
        flag(
          "EXTRA_WITHOUT_REMARKS",
          "medium",
          `Extra charges of ${rm(extra)} were added without any remarks explaining them.`,
          "Request a written justification for the extra charges from the technician.",
          { extra_charges: extra },
        ),
      );
    }

    // PAYMENT_MISMATCH / PAYMENT_NOT_COLLECTED
    const payment = num(completion.payment_amount);
    const method = completion.payment_method ?? null;
    const collected = method !== null && method !== "unpaid" && payment !== null && payment > 0;

    if (collected) {
      const diff = Math.abs(payment - final);
      if (diff > RULE_THRESHOLDS.paymentToleranceMyr) {
        const ratio = final > 0 ? diff / final : 1;
        const severity: FlagSeverity = ratio > RULE_THRESHOLDS.paymentMismatchHighRatio ? "high" : "medium";
        flags.push(
          flag(
            "PAYMENT_MISMATCH",
            severity,
            `Payment of ${rm(payment)} (${method}) differs from the final amount ${rm(final)} by ${rm(diff)}.`,
            "Reconcile the payment with the receipt and follow up on any balance or overpayment.",
            { payment_amount: payment, final_amount: final, difference: round2(diff), method },
          ),
        );
      }
    } else if (final > 0 || method === "unpaid") {
      flags.push(
        flag(
          "PAYMENT_NOT_COLLECTED",
          "low",
          method === "unpaid"
            ? `Payment marked as unpaid for a ${rm(final)} job.`
            : `No payment recorded for a ${rm(final)} job.`,
          "Notify accounts to follow up with the customer for payment.",
          { payment_amount: payment, payment_method: method, final_amount: final },
        ),
      );
    }

    // SLOW_COMPLETION
    const startedAt = order.started_at ? Date.parse(order.started_at) : NaN;
    const completedRaw = completion.completed_at ?? order.completed_at ?? null;
    const completedAt = completedRaw ? Date.parse(completedRaw) : NaN;
    if (Number.isFinite(startedAt) && Number.isFinite(completedAt)) {
      const hours = (completedAt - startedAt) / 3_600_000;
      if (hours > RULE_THRESHOLDS.slowCompletionHours) {
        flags.push(
          flag(
            "SLOW_COMPLETION",
            "low",
            `The job took ${hours.toFixed(1)} hours from start to completion.`,
            "Check whether parts, access or scope issues delayed the job.",
            { hours: round2(hours) },
          ),
        );
      }
    }
  }

  // FREQUENT_RESCHEDULE (applies regardless of completion)
  const reschedules = order.reschedule_count ?? 0;
  if (reschedules >= RULE_THRESHOLDS.frequentReschedules) {
    flags.push(
      flag(
        "FREQUENT_RESCHEDULE",
        "medium",
        `The order was rescheduled ${reschedules} times.`,
        "Review the reschedule reasons and confirm the customer relationship is in good standing.",
        { reschedule_count: reschedules },
      ),
    );
  }

  return flags;
}

/** Highest severity among flags, or null when there are none. */
export function highestSeverity(flags: { severity: FlagSeverity }[]): FlagSeverity | null {
  let best: FlagSeverity | null = null;
  for (const f of flags) if (!best || SEVERITY_RANK[f.severity] > SEVERITY_RANK[best]) best = f.severity;
  return best;
}

/** Coerce a model-proposed flag code to the AI_UPPER_SNAKE convention (never collides with rule codes). */
export function normalizeAiCode(code: string): string {
  const body = code
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^AI(_|$)/, "");
  return `AI_${body || "REVIEW"}`.slice(0, 48);
}
