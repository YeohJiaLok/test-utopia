/**
 * Contracts between the AI layer and the portal modules. Modules depend only on these
 * types + the entry points listed below, never on AI internals.
 *
 * Entry points (implemented by the AI layer):
 *  - components/ai/copilot-drawer.tsx     <CopilotDrawer />               (mounted by the app shell for managers)
 *  - components/ai/copilot-chat.tsx       <CopilotChat variant="page" | "drawer" />
 *  - components/ai/document-import.tsx    <DocumentImportButton onExtracted={(f: ExtractedOrderFields) => void} />
 *  - components/ai/ai-briefing-card.tsx   <AiBriefingCard />              (manager dashboard)
 *  - lib/ai/supervisor.ts                 runSupervisor(orderId)          (call after complete_job, via after())
 *  - lib/ai/actions.ts                    extractReceipt(formData)        (server action, technician payment step)
 *                                         rescanFlags()                   (server action, manager flags page)
 */

export interface ExtractedField<T> {
  value: T | null;
  /** 0..1 model confidence for this field */
  confidence: number;
}

/** Structured output of AI Document Understanding for a quotation / job sheet / invoice. */
export interface ExtractedOrderFields {
  customerName: ExtractedField<string>;
  phone: ExtractedField<string>;
  address: ExtractedField<string>;
  serviceTypeCode: ExtractedField<string>;
  serviceDetails: ExtractedField<string>;
  amount: ExtractedField<number>;
  date: ExtractedField<string>;
  documentType: string;
  summary: string;
}

export interface ReceiptExtraction {
  ok: boolean;
  amount: number | null;
  date: string | null;
  merchant: string | null;
  paymentMethodHint: string | null;
  confidence: number;
  error?: string;
}

/** Server-sent events streamed by POST /api/ai/chat */
export type CopilotEvent =
  | { type: "run"; runId: string }
  | { type: "status"; label: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; ok: boolean; rows: number; ms: number; summary: string }
  | { type: "text"; delta: string }
  | { type: "records"; records: { orderNo: string; orderId: string; label: string }[] }
  | { type: "done"; usage?: { input_tokens: number; output_tokens: number }; latencyMs: number }
  | { type: "error"; message: string };
