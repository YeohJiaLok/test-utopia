import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  countJobsSchema,
  emptySchema,
  listFlagsSchema,
  listTechniciansSchema,
  normalizeInstant,
  orderDetailsSchema,
  resolveLimit,
  searchJobsSchema,
  technicianPerformanceSchema,
  textMatches,
  workloadSchema,
} from "./tool-schemas";
import { TOOL_CATALOGUE } from "./catalogue";

const ALL = { emptySchema, listTechniciansSchema, searchJobsSchema, countJobsSchema, technicianPerformanceSchema, orderDetailsSchema, workloadSchema, listFlagsSchema };

describe("tool input schemas", () => {
  it.each(Object.entries(ALL))("%s converts to an object JSON Schema (as the SDK does)", (_name, schema) => {
    const json = z.toJSONSchema(schema, { reused: "ref" }) as { type?: string };
    expect(json.type).toBe("object");
  });

  it("search_jobs accepts a typical agent call", () => {
    const r = searchJobsSchema.safeParse({
      technician: "Ali",
      date_field: "completed_at",
      from: "2026-10-26T16:00:00.000Z",
      to: "2026-11-02T16:00:00.000Z",
      limit: 20,
    });
    expect(r.success).toBe(true);
  });

  it("search_jobs rejects unknown statuses, bad dates and over-cap limits", () => {
    expect(searchJobsSchema.safeParse({ status: ["done"] }).success).toBe(false);
    expect(searchJobsSchema.safeParse({ from: "last tuesday" }).success).toBe(false);
    expect(searchJobsSchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(searchJobsSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(searchJobsSchema.safeParse({ technician: "" }).success).toBe(false);
    expect(searchJobsSchema.safeParse({ technician: "x".repeat(81) }).success).toBe(false);
  });

  it("count_jobs only groups by whitelisted dimensions", () => {
    expect(countJobsSchema.safeParse({ group_by: "technician" }).success).toBe(true);
    expect(countJobsSchema.safeParse({ group_by: "customer_phone" }).success).toBe(false);
  });

  it("range tools require both bounds", () => {
    expect(workloadSchema.safeParse({ from: "2026-11-02" }).success).toBe(false);
    expect(technicianPerformanceSchema.safeParse({ from: "2026-11-02", to: "2026-11-09" }).success).toBe(true);
  });

  it("order numbers are restricted to safe characters", () => {
    expect(orderDetailsSchema.safeParse({ order_no: "SJK-2611-01001" }).success).toBe(true);
    expect(orderDetailsSchema.safeParse({ order_no: "SJK'; drop table orders;--" }).success).toBe(false);
    expect(orderDetailsSchema.safeParse({ order_no: "SJK-2611-01001,status.eq.new" }).success).toBe(false);
  });

  it("list_flags validates severities", () => {
    expect(listFlagsSchema.safeParse({ severity: ["high"] }).success).toBe(true);
    expect(listFlagsSchema.safeParse({ severity: ["critical"] }).success).toBe(false);
  });

  it("every catalogue tool has a description that tells the model when to use it", () => {
    expect(TOOL_CATALOGUE).toHaveLength(8);
    for (const t of TOOL_CATALOGUE) expect(t.description.length).toBeGreaterThan(60);
  });
});

describe("normalizeInstant", () => {
  it("treats a bare date as Malaysia midnight", () => {
    expect(normalizeInstant("2026-11-03")).toBe("2026-11-02T16:00:00.000Z");
  });
  it("keeps explicit instants", () => {
    expect(normalizeInstant("2026-11-02T16:00:00.000Z")).toBe("2026-11-02T16:00:00.000Z");
    expect(normalizeInstant("2026-11-03T00:00:00+08:00")).toBe("2026-11-02T16:00:00.000Z");
  });
});

describe("resolveLimit", () => {
  it("defaults and clamps to the row cap", () => {
    expect(resolveLimit(undefined)).toBe(20);
    expect(resolveLimit(500)).toBe(50);
    expect(resolveLimit(7.9)).toBe(7);
    expect(resolveLimit(undefined, 50)).toBe(50);
  });
});

describe("textMatches", () => {
  it("matches partial, case- and punctuation-insensitive names", () => {
    expect(textMatches("Ali Hassan", "ali")).toBe(true);
    expect(textMatches("Tan Wei Jie", "wei-jie")).toBe(true);
    expect(textMatches("Chemical wash", "CHEMICAL")).toBe(true);
    expect(textMatches("Bala Krishnan", "kumar")).toBe(false);
    expect(textMatches(null, "x")).toBe(false);
    expect(textMatches("Ali", "%")).toBe(false);
  });
});
