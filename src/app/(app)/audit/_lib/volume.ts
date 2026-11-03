import { TZDate } from "@date-fns/tz";
import { addDays, addHours, addWeeks, differenceInCalendarDays, format, startOfDay, startOfWeek } from "date-fns";
import { TIMEZONE } from "@/lib/format";
import type { ResolvedRange } from "./filters";
import type { VolumeBucket } from "./types";

export type VolumeUnit = "hour" | "day" | "week";

const tz = (v: string | Date) => new TZDate(typeof v === "string" ? new Date(v) : v, TIMEZONE);

/**
 * Activity histogram for the selected range, bucketed in Malaysia time: hourly for a single
 * day, daily up to ~2 months, weekly (Monday start) beyond that. Unbounded ranges start at
 * the oldest row seen.
 */
export function buildVolume(
  createdAt: string[],
  range: Pick<ResolvedRange, "from" | "to">,
  now: Date = new Date(),
): { buckets: VolumeBucket[]; unit: VolumeUnit } {
  const oldest = createdAt.length ? createdAt.reduce((a, b) => (a < b ? a : b)) : null;
  const start = startOfDay(tz(range.from ?? oldest ?? now));
  const endExclusive = range.to ? tz(range.to) : addDays(startOfDay(tz(now)), 1);
  const days = Math.max(1, differenceInCalendarDays(endExclusive, start));

  const unit: VolumeUnit = days <= 1 ? "hour" : days <= 62 ? "day" : "week";

  const keyOf = (d: Date) =>
    unit === "hour"
      ? format(d, "yyyy-MM-dd'T'HH")
      : unit === "day"
        ? format(d, "yyyy-MM-dd")
        : format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const buckets: VolumeBucket[] = [];
  const index = new Map<string, VolumeBucket>();
  let cursor: Date = unit === "week" ? startOfWeek(start, { weekStartsOn: 1 }) : start;
  while (cursor < endExclusive && buckets.length < 200) {
    const key = keyOf(cursor);
    const label =
      unit === "hour" ? format(cursor, "h a") : unit === "day" ? format(cursor, "EEE d MMM") : `Week of ${format(cursor, "d MMM")}`;
    const b = { key, label, count: 0 };
    buckets.push(b);
    index.set(key, b);
    cursor = unit === "hour" ? addHours(cursor, 1) : unit === "day" ? addDays(cursor, 1) : addWeeks(cursor, 1);
  }

  for (const at of createdAt) {
    const b = index.get(keyOf(tz(at)));
    if (b) b.count++;
  }
  return { buckets, unit };
}
