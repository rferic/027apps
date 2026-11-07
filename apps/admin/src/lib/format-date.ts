import type { Locale } from "@027apps/i18n/types.js";

const DEFAULT_TIME_ZONE = "UTC";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

/**
 * A stored IANA identifier can be stale after a configuration change. Creating
 * a formatter is the cheapest runtime validation; an invalid zone throws.
 */
export function resolveTimeZone(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/**
 * Formats an instant at the presentation edge (ADR 0008 §2). Server and client
 * must pass the same explicit `timeZone`; otherwise the server formats in UTC
 * and hydration compares two different calendar days.
 */
export function formatDate(
  value: string,
  { locale, timeZone }: { locale: Locale; timeZone: string },
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    ...DATE_OPTIONS,
    timeZone: resolveTimeZone(timeZone),
  }).format(date);
}
