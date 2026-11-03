import { describe, expect, it } from "vitest";
import { buildFallbackBriefing, pctChange, reconcileBriefing } from "./briefing";
import { checkUpload, sniffMime } from "./files";
import { linkifyOrders, mentionedOrderNumbers } from "./linkify";
import type { InsightStats } from "./types";

describe("linkifyOrders", () => {
  const records = [{ orderNo: "SJK-2611-01001", orderId: "id-1", label: "Chemical wash" }];
  const href = (id: string) => `/manager/orders/${id}`;

  it("links known order numbers", () => {
    expect(linkifyOrders("- SJK-2611-01001 – Chemical wash", records, href)).toBe("- [SJK-2611-01001](/manager/orders/id-1) – Chemical wash");
  });
  it("leaves unknown numbers, code spans and existing links alone", () => {
    const md = "SJK-2611-09999 and `SJK-2611-01001` and [SJK-2611-01001](/x)";
    expect(linkifyOrders(md, records, href)).toBe(md);
  });
  it("extracts mentioned order numbers", () => {
    expect([...mentionedOrderNumbers("see SJK-2611-01001, sjk-2611-01002 and SJK-2611-01001")]).toEqual(["SJK-2611-01001"]);
  });
});

describe("sniffMime / checkUpload", () => {
  const bytes = (...xs: (number | string)[]) =>
    new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

  it("detects supported formats by magic bytes", () => {
    expect(sniffMime(bytes("%PDF-1.4"))).toBe("application/pdf");
    expect(sniffMime(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMime(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("image/webp");
    expect(sniffMime(bytes("GIF89a"))).toBeNull();
  });
  it("rejects empty, oversized and disguised files", () => {
    expect(checkUpload(new Uint8Array())).toMatchObject({ ok: false, status: 400 });
    expect(checkUpload(bytes("%PDF-1.4"), { maxBytes: 4 })).toMatchObject({ ok: false, status: 413 });
    expect(checkUpload(bytes("<html><script>"))).toMatchObject({ ok: false, status: 415 });
    expect(checkUpload(bytes("%PDF-1.4"), { allowed: ["image/png"] })).toMatchObject({ ok: false, status: 415 });
    expect(checkUpload(bytes("%PDF-1.7"))).toEqual({ ok: true, mediaType: "application/pdf" });
  });
});

function stats(overrides: Partial<InsightStats> = {}): InsightStats {
  const totals = { jobsCreated: 10, jobsCompleted: 12, revenue: 3000, reschedules: 2 };
  return {
    periodStart: "2026-11-02",
    periodEnd: "2026-11-08",
    daysElapsed: 2,
    thisWeek: totals,
    lastWeek: { jobsCreated: 30, jobsCompleted: 35, revenue: 9000, reschedules: 5 },
    lastWeekToDate: { jobsCreated: 8, jobsCompleted: 10, revenue: 2500, reschedules: 1 },
    change: { jobsCompleted: 20, revenue: 20, reschedules: 100 },
    topTechnicians: [{ name: "Bala Krishnan", branch: "Petaling Jaya", jobs: 5, revenue: 1200, rating: 4.6 }],
    workload: {
      teamMean: 2.4,
      teamStdDev: 1.2,
      overloaded: [{ name: "Bala Krishnan", branch: "Petaling Jaya", jobs: 5, openJobs: 3, zScore: 2.17 }],
      idle: [{ name: "Azman Yusof", branch: "Petaling Jaya", openJobs: 0 }],
    },
    topServices: [{ name: "Chemical wash", jobs: 4, revenue: 1000 }],
    branches: [],
    backlog: { new: 2, assigned: 4, inProgress: 1, awaitingReview: 3 },
    openFlags: { total: 5, high: 1, medium: 3, low: 1 },
    ...overrides,
  };
}

describe("briefing helpers", () => {
  it("pctChange handles zero baselines", () => {
    expect(pctChange(12, 10)).toBe(20);
    expect(pctChange(5, 10)).toBe(-50);
    expect(pctChange(5, 0)).toBeNull();
  });

  it("fallback briefing uses only computed numbers", () => {
    const b = buildFallbackBriefing(stats());
    expect(b.headline).toContain("12 jobs");
    expect(b.headline).toContain("+20%");
    expect(b.overloaded).toEqual([expect.objectContaining({ technician: "Bala Krishnan", jobs: 5, z_score: 2.17 })]);
    expect(b.recommendations.join(" ")).toContain("Azman Yusof");
    expect(b.highlights.length).toBeGreaterThanOrEqual(3);
  });

  it("reconcile overrides invented overload figures and drops unknown technicians", () => {
    const out = reconcileBriefing(
      {
        headline: "  Busy week  ",
        highlights: [{ title: "t", detail: "d", tone: "neutral" }],
        overloaded: [
          { technician: "bala krishnan", jobs: 99, z_score: 9, note: "Heavy load" },
          { technician: "Invented Person", jobs: 7, z_score: 3, note: "x" },
        ],
        recommendations: ["a", "b", "c", "d", "e"],
      },
      stats(),
    );
    expect(out.headline).toBe("Busy week");
    expect(out.overloaded).toEqual([{ technician: "Bala Krishnan", jobs: 5, z_score: 2.17, note: "Heavy load" }]);
    expect(out.recommendations).toHaveLength(4);
  });

  it("reconcile adds overloaded technicians the model omitted", () => {
    const out = reconcileBriefing({ headline: "h", highlights: [], overloaded: [], recommendations: [] }, stats());
    expect(out.overloaded.map((o) => o.technician)).toEqual(["Bala Krishnan"]);
  });
});
