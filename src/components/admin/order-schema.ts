import { z } from "zod";
import { fromMytInputValue, isLocalInputValue } from "./datetime";

/**
 * Validation shared by the client form (react-hook-form) and the server action,
 * so both layers enforce exactly the same rules. All values are strings as they
 * come from inputs; conversion to DB types happens in the server action.
 */

/** Malaysian mobile → local digits ("0123456789") or null. Accepts 012-345 6789, +6012…, 6012… */
export function normalizeMyMobile(raw: string): string | null {
  let d = raw.replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith("60")) d = `0${d.slice(2)}`;
  // 011-xxxx xxxx has 8 subscriber digits; other 01x prefixes have 7.
  if (/^011\d{8}$/.test(d) || /^01[02-9]\d{7}$/.test(d)) return d;
  return null;
}

/** "0123456789" → "012-345 6789", "01123456789" → "011-2345 6789" */
export function formatMyMobile(raw: string): string {
  const d = normalizeMyMobile(raw);
  if (!d) return raw.trim();
  const prefix = d.slice(0, 3);
  const rest = d.slice(3);
  return rest.length === 8 ? `${prefix}-${rest.slice(0, 4)} ${rest.slice(4)}` : `${prefix}-${rest.slice(0, 3)} ${rest.slice(3)}`;
}

const PRICE = /^\d{1,7}(\.\d{1,2})?$/;

export const orderFormSchema = z.object({
  customerName: z.string().trim().min(2, "Enter the customer's full name").max(120, "Keep the name under 120 characters"),
  customerPhone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .refine((v) => normalizeMyMobile(v) !== null, "Enter a valid Malaysian mobile number, e.g. 012-345 6789"),
  customerAddress: z
    .string()
    .trim()
    .min(10, "Enter the full service address including postcode")
    .max(300, "Keep the address under 300 characters"),
  problemDescription: z
    .string()
    .trim()
    .min(5, "Describe the problem so the technician can prepare")
    .max(1000, "Keep the description under 1,000 characters"),
  serviceTypeId: z.string().regex(/^\d+$/, "Choose a service type"),
  quotedPrice: z
    .string()
    .trim()
    .min(1, "Enter the quoted price")
    .refine((v) => PRICE.test(v), "Enter an amount like 150 or 150.00"),
  technicianId: z.string().refine((v) => v === "" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v), "Choose a valid technician"),
  scheduledAt: z
    .string()
    .refine((v) => v === "" || isLocalInputValue(v), "Enter a valid date and time")
    .refine((v) => {
      const iso = fromMytInputValue(v);
      // Allow a small grace window so "now" doesn't fail by the time the form is submitted.
      return !iso || new Date(iso).getTime() >= Date.now() - 60 * 60 * 1000;
    }, "Schedule can't be in the past"),
  adminNotes: z.string().trim().max(1000, "Keep notes under 1,000 characters"),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;

export const ORDER_FORM_DEFAULTS: OrderFormValues = {
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  problemDescription: "",
  serviceTypeId: "",
  quotedPrice: "",
  technicianId: "",
  scheduledAt: "",
  adminNotes: "",
};

export const rescheduleSchema = z.object({
  scheduledAt: z
    .string()
    .refine((v) => isLocalInputValue(v), "Choose the new date and time")
    .refine((v) => {
      const iso = fromMytInputValue(v);
      return !!iso && new Date(iso).getTime() >= Date.now() - 60 * 60 * 1000;
    }, "The new slot can't be in the past"),
  reason: z.string().trim().min(5, "Give a short reason (min 5 characters)").max(500, "Keep the reason under 500 characters"),
});

export type RescheduleValues = z.infer<typeof rescheduleSchema>;
