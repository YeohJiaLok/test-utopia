import { describe, expect, it } from "vitest";
import {
  auditExportHref,
  auditHref,
  dayLabel,
  groupByDay,
  mytDayKey,
  parseAuditFilters,
  resolveRange,
  sanitizeSearch,
} from "./filters";

// Wednesday 4 Nov 2026, 10:30 in Kuala Lumpur (UTC+8) = 02:30Z
const NOW = new Date("2026-11-04T02:30:00Z");

describe("parseAuditFilters", () => {
  it("defaults to order events, last 30 days, page 1 of 25", () => {
    expect(parseAuditFilters({})).toEqual({
      tab: "events",
      q: "",
      action: "",
      role: "",
      status: "",
      range: "30d",
      from: "",
      to: "",
      page: 1,
      size: 25,
    });
  });

  it("only accepts actions valid for the tab", () => {
    expect(parseAuditFilters({ tab: "ai", action: "copilot" }).action).toBe("copilot");
    expect(parseAuditFilters({ tab: "ai", action: "job_closed" }).action).toBe("");
    expect(parseAuditFilters({ tab: "users", action: "role_changed" }).action).toBe("role_changed");
  });

  it("drops role on the users tab and status outside the AI tab", () => {
    expect(parseAuditFilters({ tab: "users", role: "admin" }).role).toBe("");
    expect(parseAuditFilters({ tab: "events", status: "error" }).status).toBe("");
    expect(parseAuditFilters({ tab: "ai", status: "error", role: "system" })).toMatchObject({ status: "error", role: "system" });
  });

  it("rejects junk paging and sizes", () => {
    expect(parseAuditFilters({ page: "-2", size: "7" })).toMatchObject({ page: 1, size: 25 });
    expect(parseAuditFilters({ page: "3", size: "50" })).toMatchObject({ page: 3, size: 50 });
  });

  it("validates custom dates and orders them", () => {
    expect(parseAuditFilters({ range: "custom", from: "2026-11-03", to: "2026-10-01" })).toMatchObject({
      range: "custom",
      from: "2026-10-01",
      to: "2026-11-03",
    });
    expect(parseAuditFilters({ range: "custom", from: "2026-02-30" }).range).toBe("30d");
    expect(parseAuditFilters({ range: "7d", from: "2026-01-01" })).toMatchObject({ range: "7d", from: "" });
  });

  it("reads URLSearchParams too", () => {
    expect(parseAuditFilters(new URLSearchParams("tab=ai&q=%20late%20"))).toMatchObject({ tab: "ai", q: "late" });
  });
});

describe("auditHref", () => {
  const base = parseAuditFilters({ tab: "events", action: "job_closed", role: "manager", q: "SJ-1", page: "3" });

  it("resets paging when a filter changes", () => {
    expect(auditHref(base, { role: "admin" })).toBe("/audit?q=SJ-1&action=job_closed&role=admin");
  });

  it("drops tab-specific filters when switching tab, keeps search", () => {
    expect(auditHref(base, { tab: "ai" })).toBe("/audit?tab=ai&q=SJ-1");
  });

  it("keeps the page when asked", () => {
    expect(auditHref(base, { page: 4 })).toBe("/audit?q=SJ-1&action=job_closed&role=manager&page=4");
  });

  it("returns the bare path for defaults", () => {
    expect(auditHref(parseAuditFilters({}))).toBe("/audit");
  });

  it("export link carries filters but not paging", () => {
    expect(auditExportHref({ ...base, size: 50 })).toBe("/audit/export?q=SJ-1&action=job_closed&role=manager");
  });
});

describe("resolveRange", () => {
  it("today is the Malaysia-time calendar day", () => {
    expect(resolveRange({ range: "today", from: "", to: "" }, NOW)).toMatchObject({
      from: "2026-11-03T16:00:00.000Z",
      to: "2026-11-04T16:00:00.000Z",
    });
  });

  it("7 days includes today", () => {
    expect(resolveRange({ range: "7d", from: "", to: "" }, NOW).from).toBe("2026-10-28T16:00:00.000Z");
  });

  it("all time is unbounded", () => {
    expect(resolveRange({ range: "all", from: "", to: "" }, NOW)).toMatchObject({ from: null, to: null });
  });

  it("custom range is inclusive of the end day", () => {
    expect(resolveRange({ range: "custom", from: "2026-11-01", to: "2026-11-02" }, NOW)).toEqual({
      from: "2026-10-31T16:00:00.000Z",
      to: "2026-11-02T16:00:00.000Z",
      label: "1 Nov 2026 – 2 Nov 2026",
    });
  });
});

describe("sanitizeSearch", () => {
  it("strips PostgREST syntax and wildcards", () => {
    expect(sanitizeSearch("a,b) or (id.eq.1")).toBe("a b or id.eq.1");
    expect(sanitizeSearch(" 100%  *done* ")).toBe("100 done");
  });
  it("keeps emails and order numbers", () => {
    expect(sanitizeSearch("ali@sejuk.com")).toBe("ali@sejuk.com");
    expect(sanitizeSearch("SJ-2026-0012")).toBe("SJ-2026-0012");
  });
});

describe("days", () => {
  it("buckets by Malaysia time, not UTC", () => {
    expect(mytDayKey("2026-11-03T16:30:00Z")).toBe("2026-11-04");
  });

  it("labels today and yesterday", () => {
    expect(dayLabel("2026-11-04", NOW)).toBe("Today");
    expect(dayLabel("2026-11-03", NOW)).toBe("Yesterday");
    expect(dayLabel("2026-11-01", NOW)).toBe("Sun, 1 Nov 2026");
  });

  it("groups consecutive rows by day", () => {
    const groups = groupByDay([
      { created_at: "2026-11-04T01:00:00Z" },
      { created_at: "2026-11-03T17:00:00Z" },
      { created_at: "2026-11-03T15:00:00Z" },
    ]);
    expect(groups.map((g) => [g.key, g.rows.length])).toEqual([
      ["2026-11-04", 2],
      ["2026-11-03", 1],
    ]);
  });
});
