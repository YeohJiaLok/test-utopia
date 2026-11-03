import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, startOfDay, startOfMonth, startOfWeek, format } from "date-fns";
import { TIMEZONE } from "@/lib/format";

/** Half-open [from, to) range expressed as ISO instants, bucketed in Malaysia time. */
export interface TimeRange {
  key: RangeKey;
  label: string;
  from: string;
  to: string;
}

export type RangeKey = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "last_30_days" | "last_8_weeks";

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_month: "Last month",
  last_30_days: "Last 30 days",
  last_8_weeks: "Last 8 weeks",
};

export function nowMyt(now: Date = new Date()) {
  return new TZDate(now, TIMEZONE);
}

/** Weeks start on Monday (Malaysian business convention). */
export function getRange(key: RangeKey, now: Date = new Date()): TimeRange {
  const n = nowMyt(now);
  const today = startOfDay(n);
  const week = startOfWeek(n, { weekStartsOn: 1 });
  const month = startOfMonth(n);
  let from: Date;
  let to: Date;
  switch (key) {
    case "today":
      from = today;
      to = addDays(today, 1);
      break;
    case "yesterday":
      from = addDays(today, -1);
      to = today;
      break;
    case "this_week":
      from = week;
      to = addDays(week, 7);
      break;
    case "last_week":
      from = addDays(week, -7);
      to = week;
      break;
    case "this_month":
      from = month;
      to = addMonths(month, 1);
      break;
    case "last_month":
      from = addMonths(month, -1);
      to = month;
      break;
    case "last_30_days":
      from = addDays(today, -29);
      to = addDays(today, 1);
      break;
    case "last_8_weeks":
      from = addDays(week, -49);
      to = addDays(week, 7);
      break;
  }
  return { key, label: RANGE_LABELS[key], from: from.toISOString(), to: to.toISOString() };
}

export function isRangeKey(value: unknown): value is RangeKey {
  return typeof value === "string" && value in RANGE_LABELS;
}

/** Deterministic calendar context handed to the AI agent so it never guesses dates. */
export function timeContext(now: Date = new Date()) {
  const n = nowMyt(now);
  const ranges = Object.fromEntries(
    (Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => {
      const r = getRange(k, now);
      return [k, { from: r.from, to: r.to }];
    }),
  );
  return {
    timezone: TIMEZONE,
    now: n.toISOString(),
    today: format(n, "EEEE, d MMMM yyyy"),
    week_starts_on: "Monday",
    ranges,
  };
}
