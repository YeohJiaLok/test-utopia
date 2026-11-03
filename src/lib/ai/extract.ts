import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
import type { ExtractedField, ExtractedOrderFields, ReceiptExtraction } from "@/lib/ai/contracts";
import { AI_NOT_CONFIGURED, aiModel, describeAiError, errorDetail, getAnthropic } from "@/lib/ai/client";
import { logAiRun } from "@/lib/ai/log";
import { EXTRACTION_SYSTEM_PROMPT, RECEIPT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { ExtractMimeType } from "@/lib/ai/files";

function documentBlock(base64: string, mediaType: ExtractMimeType): ContentBlockParam {
  return mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
}

// ------------------------------------------------------- order documents --

const field = <T extends z.ZodType>(value: T) => z.object({ value: value.nullable(), confidence: z.number() });

const OrderExtractionSchema = z.object({
  documentType: z.enum(["quotation", "job_sheet", "invoice", "receipt", "work_order", "other"]),
  summary: z.string(),
  customerName: field(z.string()),
  phone: field(z.string()),
  address: field(z.string()),
  serviceTypeCode: field(z.string()),
  serviceDetails: field(z.string()),
  amount: field(z.number()),
  date: field(z.string()),
});
type OrderExtraction = z.infer<typeof OrderExtractionSchema>;

function clamp01(n: number) {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, Math.round(n * 100) / 100)) : 0;
}

function cleanText(f: { value: string | null; confidence: number }, max = 500): ExtractedField<string> {
  const v = f.value?.trim().slice(0, max) ?? "";
  return v ? { value: v, confidence: clamp01(f.confidence) } : { value: null, confidence: 0 };
}

/** Post-validate model output against business constraints (codes, ranges, formats). */
export function normalizeOrderExtraction(raw: OrderExtraction, serviceCodes: string[]): ExtractedOrderFields {
  const code = raw.serviceTypeCode.value?.trim().toUpperCase() ?? null;
  const knownCode = code ? serviceCodes.find((c) => c.toUpperCase() === code) : undefined;
  const amount = raw.amount.value;
  const date = raw.date.value?.trim() ?? null;
  const validDate = date && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(date) && !Number.isNaN(Date.parse(date.slice(0, 10)));
  return {
    documentType: raw.documentType,
    summary: raw.summary.trim().slice(0, 300),
    customerName: cleanText(raw.customerName, 120),
    phone: cleanText(raw.phone, 30),
    address: cleanText(raw.address, 300),
    serviceTypeCode: knownCode ? { value: knownCode, confidence: clamp01(raw.serviceTypeCode.confidence) } : { value: null, confidence: 0 },
    serviceDetails: cleanText(raw.serviceDetails, 1000),
    amount:
      amount !== null && Number.isFinite(amount) && amount >= 0 && amount < 1_000_000
        ? { value: Math.round(amount * 100) / 100, confidence: clamp01(raw.amount.confidence) }
        : { value: null, confidence: 0 },
    date: validDate ? { value: date, confidence: clamp01(raw.date.confidence) } : { value: null, confidence: 0 },
  };
}

export type ExtractResult = { ok: true; fields: ExtractedOrderFields; runId: string | null } | { ok: false; error: string };

export async function extractOrderDocument(params: {
  base64: string;
  mediaType: ExtractMimeType;
  fileName: string;
  sizeBytes: number;
  serviceTypes: { code: string; name: string }[];
  userId: string;
}): Promise<ExtractResult> {
  const started = performance.now();
  const model = aiModel();
  const input = `${params.fileName} (${params.mediaType}, ${Math.round(params.sizeBytes / 1024)} KB)`;
  const client = getAnthropic();
  if (!client) {
    await logAiRun({ kind: "extraction", userId: params.userId, input, model: null, latencyMs: 0, status: "error", error: "ANTHROPIC_API_KEY is not configured" });
    return { ok: false, error: AI_NOT_CONFIGURED };
  }

  const catalogue = params.serviceTypes.map((s) => `- ${s.code}: ${s.name}`).join("\n") || "- (no service types configured)";
  try {
    const response = await client.messages.parse(
      {
        model,
        max_tokens: 4000,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              documentBlock(params.base64, params.mediaType),
              { type: "text", text: `Service type codes (choose serviceTypeCode from these only):\n${catalogue}\n\nExtract the order fields from this document.` },
            ],
          },
        ],
        output_config: { effort: "low", format: zodOutputFormat(OrderExtractionSchema) },
      },
      { timeout: 75_000 },
    );
    const latencyMs = performance.now() - started;
    const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      const refused = response.stop_reason === "refusal";
      await logAiRun({ kind: "extraction", userId: params.userId, input, model, ...usage, latencyMs, status: refused ? "refused" : "error", error: `stop_reason: ${response.stop_reason}` });
      return { ok: false, error: refused ? "The AI declined to process this document." : "Could not read structured data from this document." };
    }
    const fields = normalizeOrderExtraction(response.parsed_output, params.serviceTypes.map((s) => s.code));
    const runId = await logAiRun({
      kind: "extraction",
      userId: params.userId,
      input,
      output: JSON.stringify(fields),
      model,
      ...usage,
      latencyMs,
      status: "ok",
      toolCalls: [{ name: "document_understanding", input: { file: params.fileName, type: params.mediaType }, ok: true, rows: 1, ms: Math.round(latencyMs) }],
    });
    return { ok: true, fields, runId };
  } catch (err) {
    await logAiRun({ kind: "extraction", userId: params.userId, input, model, latencyMs: performance.now() - started, status: "error", error: errorDetail(err) });
    return { ok: false, error: describeAiError(err) };
  }
}

// --------------------------------------------------------------- receipts --

const ReceiptSchema = z.object({
  is_receipt: z.boolean(),
  amount: z.number().nullable(),
  date: z.string().nullable(),
  merchant: z.string().nullable(),
  payment_method_hint: z.enum(["cash", "card", "bank_transfer", "ewallet"]).nullable(),
  confidence: z.number(),
});

function receiptFailure(error: string): ReceiptExtraction {
  return { ok: false, amount: null, date: null, merchant: null, paymentMethodHint: null, confidence: 0, error };
}

export async function extractReceiptImage(params: {
  base64: string;
  mediaType: ExtractMimeType;
  fileName: string;
  sizeBytes: number;
  userId: string;
}): Promise<ReceiptExtraction> {
  const started = performance.now();
  const model = aiModel();
  const input = `receipt ${params.fileName} (${params.mediaType}, ${Math.round(params.sizeBytes / 1024)} KB)`;
  const client = getAnthropic();
  if (!client) return receiptFailure(AI_NOT_CONFIGURED);

  try {
    const response = await client.messages.parse(
      {
        model,
        max_tokens: 2000,
        system: RECEIPT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [documentBlock(params.base64, params.mediaType), { type: "text", text: "Extract the payment details from this receipt." }],
          },
        ],
        output_config: { effort: "low", format: zodOutputFormat(ReceiptSchema) },
      },
      { timeout: 60_000 },
    );
    const latencyMs = performance.now() - started;
    const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
    const out = response.parsed_output;
    if (response.stop_reason === "refusal" || !out) {
      await logAiRun({ kind: "extraction", userId: params.userId, input, model, ...usage, latencyMs, status: response.stop_reason === "refusal" ? "refused" : "error", error: `stop_reason: ${response.stop_reason}` });
      return receiptFailure("Could not read this receipt. Enter the amount manually.");
    }
    const amount = out.amount !== null && Number.isFinite(out.amount) && out.amount >= 0 ? Math.round(out.amount * 100) / 100 : null;
    const date = out.date && /^\d{4}-\d{2}-\d{2}/.test(out.date) ? out.date.slice(0, 10) : null;
    const result: ReceiptExtraction = out.is_receipt
      ? {
          ok: amount !== null,
          amount,
          date,
          merchant: out.merchant?.trim().slice(0, 120) || null,
          paymentMethodHint: out.payment_method_hint,
          confidence: clamp01(out.confidence),
          ...(amount === null ? { error: "No total amount found on the receipt." } : {}),
        }
      : receiptFailure("This image does not look like a payment receipt.");
    await logAiRun({ kind: "extraction", userId: params.userId, input, output: JSON.stringify(result), model, ...usage, latencyMs, status: "ok" });
    return result;
  } catch (err) {
    await logAiRun({ kind: "extraction", userId: params.userId, input, model, latencyMs: performance.now() - started, status: "error", error: errorDetail(err) });
    return receiptFailure(describeAiError(err));
  }
}
