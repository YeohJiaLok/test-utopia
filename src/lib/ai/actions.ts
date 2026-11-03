"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { ReceiptExtraction } from "@/lib/ai/contracts";
import { extractReceiptImage } from "@/lib/ai/extract";
import { checkUpload } from "@/lib/ai/files";
import { rescanAllFlags } from "@/lib/ai/supervisor";

function receiptError(error: string): ReceiptExtraction {
  return { ok: false, amount: null, date: null, merchant: null, paymentMethodHint: null, confidence: 0, error };
}

/**
 * Read a payment receipt photo (technician payment step) and suggest amount / date /
 * method. FormData field: `file` (PNG, JPEG, WebP or PDF, ≤ 10 MB).
 */
export async function extractReceipt(formData: FormData): Promise<ReceiptExtraction> {
  const user = await requireUser(["technician", "admin"]);
  const file = formData.get("file");
  if (!(file instanceof File)) return receiptError("Attach a receipt image.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes);
  if (!check.ok) return receiptError(check.error);

  return extractReceiptImage({
    base64: Buffer.from(bytes).toString("base64"),
    mediaType: check.mediaType,
    fileName: file.name.slice(0, 200) || "receipt",
    sizeBytes: bytes.length,
    userId: user.id,
  });
}

/** Re-run the AI Workflow Supervisor over all orders awaiting review (manager/admin). */
export async function rescanFlags(): Promise<{ scanned: number; flagged: number }> {
  const user = await requireUser(["manager", "admin"]);
  try {
    const result = await rescanAllFlags(user.id);
    revalidatePath("/manager/flags");
    revalidatePath("/manager");
    return result;
  } catch (err) {
    console.error("[ai] rescanFlags failed", err);
    throw new Error("The supervisor scan failed. Please try again.");
  }
}
