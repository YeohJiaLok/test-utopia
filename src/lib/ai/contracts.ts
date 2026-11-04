/**
 * Contracts between the AI layer and the portal modules. Modules depend only on these
 * types + the entry points listed below, never on AI internals.
 *
 * Entry points (implemented by the AI layer):
 *  - components/ai/copilot-drawer.tsx     <CopilotDrawer />               (floating assistant, admin + manager)
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

/**
 * A chart the Copilot draws from data it queried (render_chart tool). Rendered with Recharts
 * in the chat; the spec is also stored in ai_runs.tool_calls for audit.
 */
export interface ChartSpec {
  type: "bar" | "horizontal_bar" | "line" | "area" | "pie";
  title: string;
  subtitle?: string;
  /** How values are formatted: plain counts, Ringgit, percentages or hours. */
  unit: "count" | "myr" | "percent" | "hours";
  /** Series names; one or two series. */
  series: string[];
  /** One point per category / period: label plus one value per series. */
  data: { label: string; values: number[] }[];
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
  | { type: "error"; message: string }
  /** The acceptable-use policy stopped (blocked) or the model declined (refused) the question. */
  | { type: "policy"; outcome: "blocked" | "refused"; category: string; label: string }
  | { type: "chart"; chart: ChartSpec }
  /** The saved conversation this answer belongs to (sent first). */
  | { type: "conversation"; id: string; title: string };
