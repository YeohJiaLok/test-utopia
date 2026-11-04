import { describe, expect, it } from "vitest";
import { cancelOrderSchema, ORDER_FORM_DEFAULTS, orderFormSchema } from "./order-schema";

const valid = {
  ...ORDER_FORM_DEFAULTS,
  customerName: "Nur Aisyah",
  customerPhone: "012-345 6789",
  customerAddress: "No. 1, Jalan Sejuk, Shah Alam",
  serviceTypeId: "1",
  quotedPrice: "150",
  problemDescription: "Unit not cold",
  technicianId: "4a0dfc23-86e5-41d7-a6e2-8cc19f5c5224",
};

describe("new order form", () => {
  it("accepts a complete order", () => {
    expect(orderFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a technician", () => {
    const res = orderFormSchema.safeParse({ ...valid, technicianId: "" });
    expect(res.success).toBe(false);
    expect(res.error?.issues.some((i) => i.path[0] === "technicianId")).toBe(true);
  });

  it("rejects a technician id that isn't a UUID", () => {
    expect(orderFormSchema.safeParse({ ...valid, technicianId: "ali" }).success).toBe(false);
  });
});

describe("cancel order", () => {
  it("needs a known reason", () => {
    expect(cancelOrderSchema.safeParse({ reason: "customer_request", note: "" }).success).toBe(true);
    expect(cancelOrderSchema.safeParse({ reason: "because", note: "" }).success).toBe(false);
    expect(cancelOrderSchema.safeParse({ note: "" }).success).toBe(false);
  });

  it("needs a note when the reason is Other", () => {
    const res = cancelOrderSchema.safeParse({ reason: "other", note: "" });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.path).toEqual(["note"]);
    expect(cancelOrderSchema.safeParse({ reason: "other", note: "Building under renovation" }).success).toBe(true);
  });
});
