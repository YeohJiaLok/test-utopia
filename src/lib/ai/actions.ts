"use server";

import type { ReceiptExtraction } from "@/lib/ai/contracts";

// Placeholder — implemented by the AI layer (see src/lib/ai/contracts.ts).
export async function extractReceipt(_formData: FormData): Promise<ReceiptExtraction> {
  return { ok: false, amount: null, date: null, merchant: null, paymentMethodHint: null, confidence: 0, error: "Not implemented" };
}

export async function rescanFlags(): Promise<{ scanned: number; flagged: number }> {
  return { scanned: 0, flagged: 0 };
}
