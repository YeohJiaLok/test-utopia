/**
 * The Ops Copilot's tool catalogue — the complete, whitelisted set of read-only
 * queries the agent may run. Shared by the server tool definitions (descriptions
 * the model sees) and the UI ("What I can answer"). Client-safe.
 */

export type CopilotToolName =
  | "get_time_context"
  | "list_technicians"
  | "search_jobs"
  | "count_jobs"
  | "technician_performance"
  | "get_order_details"
  | "workload_analysis"
  | "list_flags";

export interface ToolCatalogueEntry {
  name: CopilotToolName;
  /** Short human label for the trace UI */
  label: string;
  /** One-line summary for the UI */
  summary: string;
  /** Prescriptive description sent to the model (when to call it, what it returns) */
  description: string;
}

export const MAX_TOOL_ROWS = 50;

export const TOOL_CATALOGUE: ToolCatalogueEntry[] = [
  {
    name: "get_time_context",
    label: "Resolve dates",
    summary: "Malaysia-time calendar: today, this/last week, months.",
    description:
      "Returns the current Malaysia time (Asia/Kuala_Lumpur) and exact ISO [from, to) ranges for today, yesterday, this_week, last_week (weeks start Monday), this_month, last_month, last_30_days and last_8_weeks. ALWAYS call this first whenever the question mentions or implies any date or period (today, this week, last month, recently…) and use the returned ranges verbatim as from/to for other tools. Never compute dates yourself.",
  },
  {
    name: "list_technicians",
    label: "List technicians",
    summary: "Field technicians, their branch, team and skills.",
    description:
      "Lists active field technicians with branch, team code and skills. Call this to resolve or disambiguate a technician name, or when the user asks who works in a branch.",
  },
  {
    name: "search_jobs",
    label: "Search jobs",
    summary: "Find individual orders by technician, status, service, branch and date.",
    description:
      "Searches individual service orders (jobs) and returns order numbers, status, service, technician, branch, amounts and timestamps (max 50 rows). Use it when the user needs the actual jobs listed (e.g. 'what jobs did Ali complete last week'). Filter by technician name (partial match), status list, service type (code or name), branch (code or name) and a date range on completed_at, created_at or scheduled_at. When date_field is completed_at and no status is given, only completed jobs (job_done, reviewed, closed) are included.",
  },
  {
    name: "count_jobs",
    label: "Count jobs",
    summary: "Totals grouped by technician, status, service, branch or day.",
    description:
      "Counts jobs matching the same filters as search_jobs and optionally groups them by technician, status, service, branch or day (Malaysia time), returning counts and summed final amounts. Use it for 'how many', 'which technician did the most', rankings and daily trends. Prefer this over search_jobs when only numbers are needed.",
  },
  {
    name: "technician_performance",
    label: "Technician KPIs",
    summary: "Jobs completed, revenue, ratings, reschedules per technician.",
    description:
      "Per-technician KPIs for a date range: jobs completed, total and average ticket (MYR), extra charges, reschedules, open jobs, average hours to complete and average review rating. Use it for performance comparisons, revenue by technician and quality questions.",
  },
  {
    name: "get_order_details",
    label: "Order details",
    summary: "Full record of one order: work done, charges, payment, media, flags.",
    description:
      "Returns the full record for one order number (e.g. SJK-2611-01001): customer (phone masked), problem, status timeline, technician, completion (work done, quoted, extra charges, final amount, payment), media counts, reschedules, review and open AI supervisor flags. Use it when the user asks about a specific order.",
  },
  {
    name: "workload_analysis",
    label: "Workload analysis",
    summary: "Overload detection: jobs per technician vs team mean (z-score).",
    description:
      "Workload statistics for a date range: per-technician completed jobs, open jobs, reschedules, team mean, standard deviation and z-score. A z-score of 1.5 or more, or an unusually high open-job count, suggests overload. Use it for 'who is overloaded / underutilised / workload balance' questions.",
  },
  {
    name: "list_flags",
    label: "Supervisor flags",
    summary: "Open AI Workflow Supervisor flags (anomalies, risks).",
    description:
      "Lists open (unresolved) AI Workflow Supervisor flags such as amounts above quotation, missing job photos, payment mismatches or frequent reschedules, with severity and order number. Use it for risk, anomaly, compliance or 'what needs my attention' questions.",
  },
];

export const TOOL_LABELS: Record<string, string> = Object.fromEntries(TOOL_CATALOGUE.map((t) => [t.name, t.label]));

export function toolEntry(name: CopilotToolName): ToolCatalogueEntry {
  return TOOL_CATALOGUE.find((t) => t.name === name)!;
}

export const COPILOT_GUARDRAILS = [
  { title: "Read-only by design", detail: "Eight whitelisted, parameterised queries. No SQL, no writes, no workflow actions." },
  { title: "Your permissions apply", detail: "Every query runs as you, so database row-level security still decides what is visible." },
  { title: "Bounded results", detail: `At most ${MAX_TOOL_ROWS} rows per query, trimmed to needed columns; customer phones are masked.` },
  { title: "Fully audited", detail: "Each run, tool call, token count and latency is written to the AI governance log." },
] as const;

export const SUGGESTED_QUESTIONS = [
  "What jobs did technician Ali complete last week?",
  "Which technician completed the most jobs this week?",
  "How many jobs were completed today?",
  "Which technician might be overloaded this week?",
] as const;

export const MAX_QUESTION_CHARS = 1000;
export const MAX_HISTORY_MESSAGES = 10;
