/**
 * Period arithmetic for periodic tasks (spec §5.3).
 *
 * Dates are plain `YYYY-MM-DD` strings in the group's timezone: a task that ends
 * "on Sunday" ends at the end of Sunday wherever the group lives, and a daylight
 * saving change never duplicates or skips an occurrence, because the period is
 * identified by its start date.
 */

export type Recurrence = "weekly" | "monthly" | "yearly";

export interface Period {
  /** First day, inclusive. */
  start: string;
  /** Last day, inclusive. */
  end: string;
}

/** The calendar date of `at` in `timezone`, as `YYYY-MM-DD`. */
export function localDate(at: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function partsOf(date: string): [number, number, number] {
  const [year, month, day] = date.split("-").map(Number);
  return [year!, month!, day!];
}

const iso = (date: Date): string => date.toISOString().slice(0, 10);

const utc = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month - 1, day));

/** Days in a month, leap years included (2024-02 and 2100-02 covered). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The period that contains `date`. Weekly periods run Monday..Sunday. */
export function periodFor(recurrence: Recurrence, date: string): Period {
  const [year, month, day] = partsOf(date);
  if (recurrence === "weekly") {
    const current = utc(year, month, day);
    const weekday = (current.getUTCDay() + 6) % 7; // Monday = 0
    const start = new Date(current.getTime() - weekday * 86_400_000);
    const end = new Date(start.getTime() + 6 * 86_400_000);
    return { start: iso(start), end: iso(end) };
  }
  if (recurrence === "monthly") {
    return {
      start: iso(utc(year, month, 1)),
      end: iso(utc(year, month, daysInMonth(year, month))),
    };
  }
  return { start: iso(utc(year, 1, 1)), end: iso(utc(year, 12, 31)) };
}

/** The period after the one that ends on `end`. */
export function nextPeriod(recurrence: Recurrence, end: string): Period {
  const [year, month, day] = partsOf(end);
  const after = new Date(utc(year, month, day).getTime() + 86_400_000);
  return periodFor(recurrence, iso(after));
}

/** Whether the period has finished at `now`, in the group's timezone. */
export function periodEnded(period: Period, now: Date, timezone: string): boolean {
  return localDate(now, timezone) > period.end;
}
