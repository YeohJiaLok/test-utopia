/**
 * Zod input schemas for the Ops Copilot tools. The SDK converts these to JSON Schema
 * for the model and validates every tool call against them before it runs. Kept free
 * of transforms/defaults (they cannot be represented in JSON Schema); normalisation
 * happens in `normalizeInstant` / `resolveLimit`.
 */
import { z } from "zod";
import { MAX_TOOL_ROWS } from "@/lib/ai/catalogue";

export const ORDER_STATUSES = ["new", "assigned", "in_progress", "rework", "job_done", "reviewed", "closed", "cancelled"] as const;
export const COMPLETED_STATUSES = ["job_done", "reviewed", "closed"] as const;
export const DATE_FIELDS = ["completed_at", "created_at", "scheduled_at"] as const;
export const GROUP_BY = ["technician", "status", "service", "branch", "day"] as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isInstant(v: string) {
  return DATE_ONLY.test(v) || !Number.isNaN(Date.parse(v));
}

const instant = (what: string) =>
  z
    .string()
    .max(40)
    .refine(isInstant, { message: "Must be an ISO 8601 date or date-time" })
    .describe(`${what} (ISO 8601). Use the exact values returned by get_time_context.`);

const name = (what: string) => z.string().trim().min(1).max(80).describe(what);

const limit = z
  .number()
  .int()
  .min(1)
  .max(MAX_TOOL_ROWS)
  .optional()
  .describe(`Maximum rows to return (1-${MAX_TOOL_ROWS}, default 20).`);

export const emptySchema = z.object({});

export const listTechniciansSchema = z.object({
  branch: name("Optional branch code or name filter, partial match").optional(),
});

const jobFilters = {
  technician: name("Technician name, partial and case-insensitive (e.g. 'Ali').").optional(),
  status: z.array(z.enum(ORDER_STATUSES)).max(7).optional().describe("Only include these order statuses."),
  service: name("Service type code or name, partial match (e.g. 'chemical wash').").optional(),
  branch: name("Branch code or name, partial match.").optional(),
  date_field: z
    .enum(DATE_FIELDS)
    .optional()
    .describe("Which timestamp from/to apply to. Use completed_at for 'completed' questions. Default created_at."),
  from: instant("Inclusive range start").optional(),
  to: instant("Exclusive range end").optional(),
};

export const searchJobsSchema = z.object({ ...jobFilters, limit });

export const countJobsSchema = z.object({
  ...jobFilters,
  group_by: z.enum(GROUP_BY).optional().describe("Group the count. Omit for a single total."),
});

export const rangeSchema = z.object({
  from: instant("Inclusive range start"),
  to: instant("Exclusive range end"),
});

export const technicianPerformanceSchema = z.object({
  ...rangeSchema.shape,
  technician: name("Optional technician name filter, partial match.").optional(),
  branch: name("Optional branch name filter, partial match.").optional(),
  limit,
});

export const orderDetailsSchema = z.object({
  order_no: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "Order numbers contain only letters, digits and dashes")
    .describe("The order number, e.g. SJK-2611-01001."),
});

export const workloadSchema = rangeSchema;

export const listFlagsSchema = z.object({
  severity: z.array(z.enum(["low", "medium", "high"])).max(3).optional().describe("Only these severities."),
  limit,
});

export type SearchJobsInput = z.infer<typeof searchJobsSchema>;
export type CountJobsInput = z.infer<typeof countJobsSchema>;
export type TechnicianPerformanceInput = z.infer<typeof technicianPerformanceSchema>;
export type ListFlagsInput = z.infer<typeof listFlagsSchema>;

/**
 * Normalise a model-supplied instant. A bare date (YYYY-MM-DD) is midnight in
 * Malaysia time (UTC+8, no DST), not UTC.
 */
export function normalizeInstant(value: string): string {
  if (DATE_ONLY.test(value)) return new Date(`${value}T00:00:00+08:00`).toISOString();
  return new Date(value).toISOString();
}

export function resolveLimit(value: number | undefined, fallback = 20): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(MAX_TOOL_ROWS, Math.trunc(value)));
}

/**
 * Case- and accent-insensitive partial match used to resolve technician / service /
 * branch names against small reference tables (no user text reaches a SQL filter).
 */
export function textMatches(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  const norm = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const n = norm(needle);
  return n.length > 0 && norm(haystack).includes(n);
}
