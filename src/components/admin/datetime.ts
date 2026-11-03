import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { TIMEZONE } from "@/lib/format";

/**
 * `<input type="datetime-local">` has no timezone. All scheduling in Sejuk Ops is
 * entered in Malaysia time (UTC+8, no DST), so we convert explicitly in both directions.
 */
const LOCAL_INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function isLocalInputValue(value: string) {
  return LOCAL_INPUT.test(value);
}

/** ISO instant → "2026-11-03T14:30" in Malaysia time. */
export function toMytInputValue(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return format(new TZDate(d, TIMEZONE), "yyyy-MM-dd'T'HH:mm");
}

/** "2026-11-03T14:30" (Malaysia time) → ISO instant, or null when empty / invalid. */
export function fromMytInputValue(value: string | null | undefined): string | null {
  if (!value || !isLocalInputValue(value)) return null;
  const d = new Date(`${value}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Current Malaysia-time YYMM, used to preview the order number format. */
export function currentOrderPrefix(now: Date = new Date()) {
  return `SJK-${format(new TZDate(now, TIMEZONE), "yyMM")}`;
}

/**
 * Best-effort conversion of a date found in a document (e.g. "2026-11-05",
 * "05/11/2026 2:30 PM") into a datetime-local value. Date-only values default to 10:00 AM.
 */
export function documentDateToInputValue(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2}))?/);
  if (iso) {
    const [, y, m, d, hh, mm] = iso;
    return `${y}-${m}-${d}T${(hh ?? "10").padStart(2, "0")}:${mm ?? "00"}`;
  }
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[,\s]+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (dmy) {
    const [, d, m, y, hRaw, mm, ampm] = dmy;
    let h = hRaw ? Number(hRaw) : 10;
    if (ampm) {
      const pm = ampm.toLowerCase() === "pm";
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
    }
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}T${String(h).padStart(2, "0")}:${mm ?? "00"}`;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? "" : toMytInputValue(parsed);
}
