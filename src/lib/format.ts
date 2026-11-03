import { TZDate } from "@date-fns/tz";
import { format, formatDistanceToNowStrict } from "date-fns";

export const TIMEZONE = "Asia/Kuala_Lumpur";

const currency = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2 });
const currencyCompact = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  notation: "compact",
  maximumFractionDigits: 1,
});
const number = new Intl.NumberFormat("en-MY");

export function formatMYR(value: number | string | null | undefined, opts?: { compact?: boolean }) {
  const n = Number(value ?? 0);
  return (opts?.compact ? currencyCompact : currency).format(Number.isFinite(n) ? n : 0);
}

export function formatNumber(value: number | string | null | undefined) {
  return number.format(Number(value ?? 0));
}

function toMyt(value: string | Date) {
  return new TZDate(typeof value === "string" ? new Date(value) : value, TIMEZONE);
}

/** 03 Nov 2026, 4:43 PM (MYT) */
export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return format(toMyt(value), "dd MMM yyyy, h:mm a");
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return format(toMyt(value), "dd MMM yyyy");
}

export function formatTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return format(toMyt(value), "h:mm a");
}

export function formatDayShort(value: string | Date) {
  return format(toMyt(value), "EEE d");
}

export function formatRelative(value: string | Date | null | undefined) {
  if (!value) return "—";
  return formatDistanceToNowStrict(typeof value === "string" ? new Date(value) : value, { addSuffix: true });
}

export function maskPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return phone;
  return `${digits.slice(0, 3)}-***${digits.slice(-4)}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
