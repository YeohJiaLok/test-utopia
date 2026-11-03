import { describe, expect, it } from "vitest";
import { generateSeed, SERVICE_TYPES, BRANCHES } from "./seed-data";
import { buildSeedFlags } from "./seed-flags";

describe("seed supervisor flags", () => {
  it("raises open flags on jobs awaiting review", () => {
    const now = new Date("2026-11-03T02:30:00Z");
    const data = generateSeed(
      {
        branchId: Object.fromEntries(BRANCHES.map((b, i) => [b.code, i + 1])) as never,
        serviceId: Object.fromEntries(SERVICE_TYPES.map((s, i) => [s.code, i + 1])) as never,
        profileByTech: {}, adminProfileId: "a", managerProfileId: "m", adminName: "A", managerName: "M",
      },
      now,
    );
    const flags = buildSeedFlags(data, now);
    const open = flags.filter((f) => !f.resolved);
    expect(open.length).toBeGreaterThan(0);
    const codes = new Set(open.map((f) => f.rule_code));
    expect(codes.has("AMOUNT_OVER_QUOTE") || codes.has("NO_MEDIA")).toBe(true);
    console.log("open flags by rule:", Object.fromEntries([...codes].map((c) => [c, open.filter((f) => f.rule_code === c).length])));
  });
});
