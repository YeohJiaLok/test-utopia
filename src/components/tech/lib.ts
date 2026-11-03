import { TZDate } from "@date-fns/tz";
import { addDays, format, startOfDay } from "date-fns";
import { TIMEZONE } from "@/lib/format";
import type { AttachmentKind, PaymentMethod } from "@/lib/types";

/** Pure helpers shared by the technician portal (server + client safe). */

export const MAX_JOB_MEDIA = 6;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // job-media bucket file_size_limit

export const WORK_DONE_CHIPS = [
  "General cleaning",
  "Chemical wash",
  "Gas top-up (R32)",
  "Filter cleaned",
  "Drain pipe flushed",
  "Capacitor replaced",
  "Thermostat checked",
] as const;

export const EXTRA_CHARGE_CHIPS = [20, 50, 100] as const;

export const RESCHEDULE_REASONS = [
  "Customer not home",
  "Customer requested new time",
  "Parts unavailable",
  "Previous job overran",
  "Bad weather",
  "Site access issue",
] as const;

export const PAYMENT_METHODS: PaymentMethod[] = ["cash", "card", "bank_transfer", "ewallet", "unpaid"];

export function greetingFor(now: Date = new Date()) {
  const hour = new TZDate(now, TIMEZONE).getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "Tuesday, 3 November" in Malaysia time. */
export function longToday(now: Date = new Date()) {
  return format(new TZDate(now, TIMEZONE), "EEEE, d MMMM");
}

/** Day bucket key (yyyy-MM-dd) in Malaysia time. */
export function mytDayKey(value: string | Date) {
  return format(new TZDate(typeof value === "string" ? new Date(value) : value, TIMEZONE), "yyyy-MM-dd");
}

/** "Today" / "Yesterday" / "Mon, 2 Nov" for a MYT day key. */
export function dayLabel(dayKey: string, now: Date = new Date()) {
  const today = startOfDay(new TZDate(now, TIMEZONE));
  if (dayKey === format(today, "yyyy-MM-dd")) return "Today";
  if (dayKey === format(addDays(today, -1), "yyyy-MM-dd")) return "Yesterday";
  const [y, m, d] = dayKey.split("-").map(Number);
  return format(new Date(y!, m! - 1, d!), "EEE, d MMM");
}

/** "Today · 10:30 AM", "Tomorrow · 2:00 PM", "Wed, 4 Nov · 9:00 AM" (Malaysia time). */
export function scheduleLabel(value: string | null | undefined, now: Date = new Date()) {
  if (!value) return "Not scheduled yet";
  const when = new TZDate(new Date(value), TIMEZONE);
  const key = format(when, "yyyy-MM-dd");
  const tomorrow = format(addDays(startOfDay(new TZDate(now, TIMEZONE)), 1), "yyyy-MM-dd");
  const day = key === tomorrow ? "Tomorrow" : dayLabel(key, now);
  return `${day} · ${format(when, "h:mm a")}`;
}

/**
 * Short countdown for jobs within ±12 hours: "in 45 min", "in 2 h 10 min", "25 min late"; "Overdue"
 * beyond that. Returns null for jobs further out (the absolute schedule label is clearer there).
 */
export function countdownLabel(value: string | null | undefined, now: Date = new Date()) {
  if (!value) return null;
  const diffMin = Math.round((new Date(value).getTime() - now.getTime()) / 60000);
  if (diffMin > 12 * 60) return null;
  if (diffMin < -12 * 60) return { label: "Overdue", late: true };
  const abs = Math.abs(diffMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span = h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  if (diffMin < -1) return { label: `${span} late`, late: true };
  if (diffMin <= 1) return { label: "Due now", late: false };
  return { label: `in ${span}`, late: false };
}

export function isOverdue(scheduledAt: string | null | undefined, now: Date = new Date()) {
  return !!scheduledAt && new Date(scheduledAt).getTime() < now.getTime();
}

/** A `datetime-local` value N days from today at the given hour, Malaysia time. */
export function mytSlot(daysFromToday: number, hour: number, now: Date = new Date()) {
  const day = addDays(startOfDay(new TZDate(now, TIMEZONE)), daysFromToday);
  day.setHours(hour, 0, 0, 0);
  return format(day, "yyyy-MM-dd'T'HH:mm");
}

/** `datetime-local` value (yyyy-MM-ddTHH:mm) for an instant, in Malaysia time. */
export function toMytInputValue(value: Date) {
  return format(new TZDate(value, TIMEZONE), "yyyy-MM-dd'T'HH:mm");
}

/** Malaysia has no DST, so a `datetime-local` value maps to a fixed +08:00 offset. */
export function fromMytInputValue(value: string) {
  return new Date(`${value}:00+08:00`);
}

export function attachmentKindFor(mime: string): Exclude<AttachmentKind, "receipt"> | null {
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return null;
}

/** Storage-safe file name: lowercase ascii, dashes, keeps the extension, max ~60 chars. */
export function safeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  const clean = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  const b = clean(base).slice(0, 48) || "file";
  const e = clean(ext).slice(0, 8);
  return e ? `${b}.${e}` : b;
}

/** Parses a user-entered money string; returns null when invalid. */
export function parseAmount(value: string): number | null {
  const trimmed = value.replace(/,/g, "").trim();
  if (trimmed === "") return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
