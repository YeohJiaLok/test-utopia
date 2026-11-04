import { describe, expect, it } from "vitest";
import { generateSeed, SERVICE_TYPES, BRANCHES, TECHNICIANS } from "./seed-data";
import { SAMPLE_ACCOUNTS } from "./sample-accounts";

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
    expect([...statuses].sort()).toEqual(["assigned", "cancelled", "closed", "in_progress", "job_done", "reviewed"]);
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

describe("technician roster and login accounts", () => {
  it("gives every rostered technician exactly one technician login, and no login without a roster entry", () => {
    const techAccounts = SAMPLE_ACCOUNTS.filter((a) => a.role === "technician");
    expect(TECHNICIANS.every((t) => t.account)).toBe(true);
    expect(new Set(TECHNICIANS.map((t) => t.account)).size).toBe(TECHNICIANS.length);
    expect(techAccounts.map((a) => a.key).sort()).toEqual(TECHNICIANS.map((t) => t.account!).sort());
    for (const t of TECHNICIANS) {
      expect(techAccounts.find((a) => a.key === t.account)?.fullName).toBe(t.name);
    }
    expect(new Set(SAMPLE_ACCOUNTS.map((a) => a.email)).size).toBe(SAMPLE_ACCOUNTS.length);
  });
});

describe("dispatch rules in the demo data", () => {
  it("assigns every order a technician (create_order requires one)", () => {
    const seed = generateSeed(refs, new Date("2026-11-04T03:00:00Z"));
    expect(seed.orders.every((o) => o.assigned_technician_id)).toBe(true);
    expect(seed.orders.some((o) => o.status === "new")).toBe(false);
  });

  it("gives every cancelled order a reason, a time and an audit event", () => {
    const now = new Date("2026-11-04T03:00:00Z");
    const seed = generateSeed(refs, now);
    const cancelled = seed.orders.filter((o) => o.status === "cancelled");
    expect(cancelled.length).toBeGreaterThan(0);
    for (const o of cancelled) {
      expect(o.cancel_reason).toBeTruthy();
      expect(new Date(o.cancelled_at as string).getTime()).toBeLessThanOrEqual(now.getTime());
      expect(o.started_at).toBeNull();
      expect(seed.events.some((e) => e.order_id === o.id && e.action === "order_cancelled")).toBe(true);
    }
  });
});
