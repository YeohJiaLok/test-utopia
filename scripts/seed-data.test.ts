import { describe, expect, it } from "vitest";
import { generateSeed, SERVICE_TYPES, BRANCHES } from "./seed-data";

const refs = {
  branchId: Object.fromEntries(BRANCHES.map((b, i) => [b.code, i + 1])) as never,
  serviceId: Object.fromEntries(SERVICE_TYPES.map((s, i) => [s.code, i + 1])) as never,
  profileByTech: { "Ali Hassan": "p-ali", "Bala Krishnan": "p-bala" },
  adminProfileId: "p-admin",
  managerProfileId: "p-manager",
  adminName: "Admin",
  managerName: "Manager",
};
const NOW = new Date("2026-11-03T02:30:00Z");

describe("seed generator", () => {
  const data = generateSeed(refs, NOW);

  it("is deterministic", () => {
    expect(generateSeed(refs, NOW).orders.map((o) => o.order_no)).toEqual(data.orders.map((o) => o.order_no));
  });

  it("produces ~8 weeks of orders across every status", () => {
    expect(data.orders.length).toBeGreaterThan(300);
    const statuses = new Set(data.orders.map((o) => o.status));
    expect([...statuses].sort()).toEqual(["assigned", "closed", "in_progress", "job_done", "new", "reviewed"]);
  });

  it("never dates lifecycle events in the future", () => {
    for (const o of data.orders) {
      for (const k of ["created_at", "assigned_at", "started_at", "completed_at", "reviewed_at", "closed_at"]) {
        if (o[k]) expect(new Date(o[k] as string).getTime()).toBeLessThanOrEqual(NOW.getTime());
      }
    }
  });

  it("never dates reschedules or audit events in the future, whatever the seed time", () => {
    for (let h = 0; h < 48; h += 7) {
      const now = new Date(NOW.getTime() + h * 3_600_000);
      const d = generateSeed(refs, now);
      for (const r of [...d.reschedules, ...d.events]) {
        expect(new Date(r.created_at as string).getTime()).toBeLessThanOrEqual(now.getTime());
      }
    }
  });

  it("only completed orders have completion records, never more than 6 media each", () => {
    const done = new Set(data.orders.filter((o) => ["job_done", "reviewed", "closed"].includes(o.status as string)).map((o) => o.id));
    expect(data.completions.every((c) => done.has(c.order_id))).toBe(true);
    const counts = new Map<unknown, number>();
    data.attachments.forEach((a) => counts.set(a.order_id, (counts.get(a.order_id) ?? 0) + 1));
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(6);
  });

  it("includes anomalies for the AI supervisor to find", () => {
    const overQuote = data.completions.filter((c) => Number(c.extra_charges) > Number(c.quoted_price) * 0.5);
    expect(overQuote.length).toBeGreaterThan(0);
  });
});
