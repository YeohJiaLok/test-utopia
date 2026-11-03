import { describe, expect, it } from "vitest";
import { getRange, timeContext } from "@/lib/time";

// Tuesday 3 Nov 2026, 10:30 in Kuala Lumpur (UTC+8) = 02:30Z
const NOW = new Date("2026-11-03T02:30:00Z");

const utc = (iso: string) => new Date(iso).toISOString();

describe("Malaysia-time ranges", () => {
  it("today starts at local midnight", () => {
    const r = getRange("today", NOW);
    expect(utc(r.from)).toBe("2026-11-02T16:00:00.000Z");
    expect(utc(r.to)).toBe("2026-11-03T16:00:00.000Z");
  });

  it("weeks start on Monday", () => {
    const r = getRange("this_week", NOW);
    expect(utc(r.from)).toBe("2026-11-01T16:00:00.000Z"); // Mon 2 Nov 00:00 MYT
    expect(utc(r.to)).toBe("2026-11-08T16:00:00.000Z");
  });

  it("last week is the previous Monday–Sunday", () => {
    const r = getRange("last_week", NOW);
    expect(utc(r.from)).toBe("2026-10-25T16:00:00.000Z");
    expect(utc(r.to)).toBe("2026-11-01T16:00:00.000Z");
  });

  it("handles the hour just after local midnight (still UTC previous day)", () => {
    const justAfterMidnight = new Date("2026-11-02T16:05:00Z"); // 00:05 Tue MYT
    expect(utc(getRange("today", justAfterMidnight).from)).toBe("2026-11-02T16:00:00.000Z");
  });

  it("exposes a deterministic calendar for the AI agent", () => {
    const ctx = timeContext(NOW);
    expect(ctx.timezone).toBe("Asia/Kuala_Lumpur");
    expect(ctx.today).toBe("Tuesday, 3 November 2026");
    expect(Object.keys(ctx.ranges)).toContain("last_week");
  });
});
