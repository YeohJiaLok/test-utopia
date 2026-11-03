import { describe, expect, it } from "vitest";
import { evaluateRules, highestSeverity, normalizeAiCode, type RuleInput } from "./rules";

/** A clean, compliant completed job: no rule should fire. */
function base(overrides: { order?: Partial<RuleInput["order"]>; completion?: Partial<NonNullable<RuleInput["completion"]>> | null; attachments?: RuleInput["attachments"] } = {}): RuleInput {
  return {
    order: { quoted_price: 200, reschedule_count: 0, started_at: "2026-11-03T01:00:00Z", completed_at: "2026-11-03T03:00:00Z", ...overrides.order },
    completion:
      overrides.completion === null
        ? null
        : {
            quoted_price: 200,
            extra_charges: 0,
            final_amount: 200,
            remarks: null,
            payment_amount: 200,
            payment_method: "cash",
            completed_at: "2026-11-03T03:00:00Z",
            ...overrides.completion,
          },
    attachments: overrides.attachments ?? [{ kind: "photo" }],
  };
}

const codes = (input: RuleInput) => evaluateRules(input).map((f) => f.rule_code);
const find = (input: RuleInput, code: string) => evaluateRules(input).find((f) => f.rule_code === code);

describe("evaluateRules", () => {
  it("raises nothing for a clean job", () => {
    expect(evaluateRules(base())).toEqual([]);
  });

  describe("AMOUNT_OVER_QUOTE", () => {
    it("does not fire at exactly 125% of quote", () => {
      expect(codes(base({ completion: { extra_charges: 50, final_amount: 250, remarks: "parts", payment_amount: 250 } }))).not.toContain("AMOUNT_OVER_QUOTE");
    });
    it("is medium just above 125%", () => {
      const f = find(base({ completion: { extra_charges: 52, final_amount: 252, remarks: "parts", payment_amount: 252 } }), "AMOUNT_OVER_QUOTE");
      expect(f?.severity).toBe("medium");
    });
    it("is medium at exactly 150%", () => {
      const f = find(base({ completion: { extra_charges: 100, final_amount: 300, remarks: "parts", payment_amount: 300 } }), "AMOUNT_OVER_QUOTE");
      expect(f?.severity).toBe("medium");
    });
    it("is high above 150% and records the ratio", () => {
      const f = find(base({ completion: { extra_charges: 120, final_amount: 320, remarks: "parts", payment_amount: 320 } }), "AMOUNT_OVER_QUOTE");
      expect(f?.severity).toBe("high");
      expect(f?.evidence.ratio).toBe(1.6);
    });
    it("accepts PostgREST numeric strings", () => {
      const f = find(base({ completion: { quoted_price: "100.00", extra_charges: "60.00", final_amount: "160.00", remarks: "x", payment_amount: "160.00" } }), "AMOUNT_OVER_QUOTE");
      expect(f?.severity).toBe("high");
    });
    it("flags a charge with no quotation as medium", () => {
      const f = find(base({ order: { quoted_price: 0 }, completion: { quoted_price: 0, final_amount: 80, payment_amount: 80 } }), "AMOUNT_OVER_QUOTE");
      expect(f?.severity).toBe("medium");
    });
  });

  describe("NO_MEDIA", () => {
    it("is high when no photo/video/pdf exists", () => {
      expect(find(base({ attachments: [] }), "NO_MEDIA")?.severity).toBe("high");
    });
    it("ignores receipts as evidence", () => {
      expect(codes(base({ attachments: [{ kind: "receipt" }] }))).toContain("NO_MEDIA");
    });
    it.each(["photo", "video", "pdf"] as const)("is satisfied by a %s", (kind) => {
      expect(codes(base({ attachments: [{ kind }] }))).not.toContain("NO_MEDIA");
    });
  });

  describe("EXTRA_WITHOUT_REMARKS", () => {
    it("is medium for extra charges with blank remarks", () => {
      const f = find(base({ completion: { extra_charges: 20, final_amount: 220, remarks: "   ", payment_amount: 220 } }), "EXTRA_WITHOUT_REMARKS");
      expect(f?.severity).toBe("medium");
    });
    it("does not fire when remarks explain the extra", () => {
      expect(codes(base({ completion: { extra_charges: 20, final_amount: 220, remarks: "Extra piping", payment_amount: 220 } }))).not.toContain("EXTRA_WITHOUT_REMARKS");
    });
    it("does not fire with zero extra charges", () => {
      expect(codes(base({ completion: { extra_charges: 0, remarks: "" } }))).not.toContain("EXTRA_WITHOUT_REMARKS");
    });
  });

  describe("PAYMENT_MISMATCH", () => {
    it("tolerates a difference of exactly RM1", () => {
      expect(codes(base({ completion: { payment_amount: 199 } }))).not.toContain("PAYMENT_MISMATCH");
    });
    it("is medium just above RM1 and within 20%", () => {
      expect(find(base({ completion: { payment_amount: 180 } }), "PAYMENT_MISMATCH")?.severity).toBe("medium");
    });
    it("is medium at exactly 20%", () => {
      expect(find(base({ completion: { payment_amount: 160 } }), "PAYMENT_MISMATCH")?.severity).toBe("medium");
    });
    it("is high above 20% (overpayment too)", () => {
      expect(find(base({ completion: { payment_amount: 250 } }), "PAYMENT_MISMATCH")?.severity).toBe("high");
    });
    it("does not apply when marked unpaid", () => {
      expect(codes(base({ completion: { payment_method: "unpaid", payment_amount: 50 } }))).not.toContain("PAYMENT_MISMATCH");
    });
  });

  describe("PAYMENT_NOT_COLLECTED", () => {
    it("is low when method is unpaid", () => {
      expect(find(base({ completion: { payment_method: "unpaid", payment_amount: null } }), "PAYMENT_NOT_COLLECTED")?.severity).toBe("low");
    });
    it("is low when no payment is recorded", () => {
      expect(find(base({ completion: { payment_method: null, payment_amount: null } }), "PAYMENT_NOT_COLLECTED")?.severity).toBe("low");
    });
    it("treats a zero payment as not collected (not a mismatch)", () => {
      const c = codes(base({ completion: { payment_method: "cash", payment_amount: 0 } }));
      expect(c).toContain("PAYMENT_NOT_COLLECTED");
      expect(c).not.toContain("PAYMENT_MISMATCH");
    });
  });

  describe("FREQUENT_RESCHEDULE", () => {
    it("does not fire at one reschedule", () => {
      expect(codes(base({ order: { reschedule_count: 1 } }))).not.toContain("FREQUENT_RESCHEDULE");
    });
    it("is medium at two reschedules", () => {
      expect(find(base({ order: { reschedule_count: 2 } }), "FREQUENT_RESCHEDULE")?.severity).toBe("medium");
    });
    it("applies even before completion", () => {
      expect(codes(base({ order: { reschedule_count: 3 }, completion: null }))).toEqual(["FREQUENT_RESCHEDULE"]);
    });
  });

  describe("SLOW_COMPLETION", () => {
    it("does not fire at exactly 6 hours", () => {
      expect(codes(base({ completion: { completed_at: "2026-11-03T07:00:00Z" } }))).not.toContain("SLOW_COMPLETION");
    });
    it("is low above 6 hours", () => {
      const f = find(base({ completion: { completed_at: "2026-11-03T07:30:00Z" } }), "SLOW_COMPLETION");
      expect(f?.severity).toBe("low");
      expect(f?.evidence.hours).toBe(6.5);
    });
    it("falls back to the order completion time", () => {
      expect(codes(base({ order: { completed_at: "2026-11-03T09:00:00Z" }, completion: { completed_at: null } }))).toContain("SLOW_COMPLETION");
    });
    it("is skipped when the start time is unknown", () => {
      expect(codes(base({ order: { started_at: null }, completion: { completed_at: "2026-11-04T09:00:00Z" } }))).not.toContain("SLOW_COMPLETION");
    });
  });

  it("only applies completion rules when a completion exists", () => {
    expect(evaluateRules(base({ completion: null, attachments: [] }))).toEqual([]);
  });

  it("every flag carries title, explanation and recommended action", () => {
    const flags = evaluateRules(
      base({
        order: { reschedule_count: 4 },
        completion: { extra_charges: 200, final_amount: 400, remarks: "", payment_amount: 100, completed_at: "2026-11-03T12:00:00Z" },
        attachments: [],
      }),
    );
    expect(flags.map((f) => f.rule_code).sort()).toEqual(
      ["AMOUNT_OVER_QUOTE", "EXTRA_WITHOUT_REMARKS", "FREQUENT_RESCHEDULE", "NO_MEDIA", "PAYMENT_MISMATCH", "SLOW_COMPLETION"].sort(),
    );
    for (const f of flags) {
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.explanation.length).toBeGreaterThan(0);
      expect(f.recommended_action.length).toBeGreaterThan(0);
    }
  });
});

describe("highestSeverity", () => {
  it("returns the most severe level", () => {
    expect(highestSeverity([{ severity: "low" }, { severity: "high" }, { severity: "medium" }])).toBe("high");
    expect(highestSeverity([])).toBeNull();
  });
});

describe("normalizeAiCode", () => {
  it.each([
    ["AI_WORK_MISMATCH", "AI_WORK_MISMATCH"],
    ["work mismatch", "AI_WORK_MISMATCH"],
    ["ai-vague-notes", "AI_VAGUE_NOTES"],
    ["AIRCON_MISMATCH", "AI_AIRCON_MISMATCH"],
    ["!!!", "AI_REVIEW"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeAiCode(input)).toBe(expected);
  });
  it("never produces a deterministic rule code", () => {
    expect(normalizeAiCode("NO_MEDIA")).toBe("AI_NO_MEDIA");
  });
});
