import { describe, expect, it } from "vitest";
import { buildVolume } from "./volume";
import { resolveRange } from "./filters";

const NOW = new Date("2026-11-04T02:30:00Z"); // Wed 4 Nov 2026 10:30 MYT

describe("buildVolume", () => {
  it("uses hourly buckets for a single day", () => {
    const r = resolveRange({ range: "today", from: "", to: "" }, NOW);
    const v = buildVolume(["2026-11-04T01:10:00Z", "2026-11-04T01:50:00Z", "2026-11-03T17:00:00Z"], r, NOW);
    expect(v.unit).toBe("hour");
    expect(v.buckets).toHaveLength(24);
    expect(v.buckets.find((b) => b.key === "2026-11-04T09")?.count).toBe(2); // 09:xx MYT
    expect(v.buckets.find((b) => b.key === "2026-11-04T01")?.count).toBe(1);
  });

  it("uses daily buckets for 7 days, in Malaysia time", () => {
    const r = resolveRange({ range: "7d", from: "", to: "" }, NOW);
    const v = buildVolume(["2026-11-03T16:30:00Z"], r, NOW);
    expect(v.unit).toBe("day");
    expect(v.buckets).toHaveLength(7);
    expect(v.buckets.at(-1)).toMatchObject({ key: "2026-11-04", count: 1 });
  });

  it("switches to weekly buckets for long ranges", () => {
    const r = resolveRange({ range: "90d", from: "", to: "" }, NOW);
    const v = buildVolume(["2026-11-02T03:00:00Z"], r, NOW);
    expect(v.unit).toBe("week");
    expect(v.buckets.at(-1)).toMatchObject({ key: "2026-11-02", count: 1 }); // Monday start
  });

  it("starts unbounded ranges at the oldest row", () => {
    const v = buildVolume(["2026-11-01T03:00:00Z"], { from: null, to: null }, NOW);
    expect(v.buckets[0]?.key).toBe("2026-11-01");
    expect(v.buckets).toHaveLength(4);
  });
});
