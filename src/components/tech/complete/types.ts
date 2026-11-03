import type { PaymentMethod } from "@/lib/types";

export interface WizardOrder {
  id: string;
  orderNo: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  quotedPrice: number;
}

export interface ExistingMedia {
  id: string;
  kind: "photo" | "video" | "pdf";
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
  removable: boolean;
}

export interface ExistingReceipt {
  id: string;
  storagePath: string;
  url: string | null;
}

export interface CompletionOutcome {
  finalAmount: number;
  completedAt: string;
  feedback: { id: string; deepLink: string } | null;
}

/** Text fields + position persisted to localStorage while the technician works. */
export interface Draft {
  step: number;
  workDone: string;
  extraCharges: string;
  remarks: string;
  paymentEnabled: boolean;
  /** null = follow the final amount */
  paymentAmount: string | null;
  paymentMethod: PaymentMethod | null;
}

export const EMPTY_DRAFT: Draft = {
  step: 0,
  workDone: "",
  extraCharges: "",
  remarks: "",
  paymentEnabled: false,
  paymentAmount: null,
  paymentMethod: null,
};

export const STEPS = [
  { key: "work", label: "Work" },
  { key: "charges", label: "Charges" },
  { key: "media", label: "Media" },
  { key: "payment", label: "Payment" },
  { key: "review", label: "Review" },
] as const;

const draftKey = (orderId: string) => `sejuk:complete-draft:${orderId}`;

export function loadDraft(orderId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(orderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    const step = Number(parsed.step);
    return {
      ...EMPTY_DRAFT,
      ...parsed,
      step: Number.isInteger(step) && step >= 0 && step < STEPS.length ? step : 0,
    };
  } catch {
    return null;
  }
}

export function saveDraft(orderId: string, draft: Draft) {
  try {
    window.localStorage.setItem(draftKey(orderId), JSON.stringify(draft));
  } catch {
    // Storage full / private mode: the draft is a convenience only.
  }
}

export function clearDraft(orderId: string) {
  try {
    window.localStorage.removeItem(draftKey(orderId));
  } catch {
    // ignore
  }
}

export function hasDraftContent(d: Draft) {
  return d.step > 0 || d.workDone.trim() !== "" || d.extraCharges !== "" || d.remarks.trim() !== "";
}
