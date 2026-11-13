/**
 * Minimal 5-field cron for module jobs: `minute hour day month weekday`.
 *
 * Supported per field: `*`, a number, `a-b`, `* / n`, `a-b/n` and comma lists.
 * Sunday is `0` (or `7`). Month and weekday are evaluated as calendar values,
 * and day-of-month and weekday must **both** match when both are restricted —
 * a deliberate simplification of cron's OR, documented in the module contract.
 */
const FIELDS = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12 },
  { min: 0, max: 7 },
] as const;

function expand(part: string, min: number, max: number): number[] | null {
  const [range, stepText] = part.split("/");
  const step = stepText === undefined ? 1 : Number(stepText);
  if (!Number.isInteger(step) || step < 1) return null;

  let start = min;
  let end = max;
  if (range !== "*") {
    const bounds = range.split("-");
    start = Number(bounds[0]);
    end = bounds.length === 2 ? Number(bounds[1]) : start;
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
    if (bounds.length === 1 && stepText !== undefined) end = max;
  }
  if (start < min || end > max || start > end) return null;

  const values: number[] = [];
  for (let value = start; value <= end; value += step) values.push(value);
  return values;
}

/** Values of one field, or `null` when the field is malformed or out of range. */
export function parseCronField(field: string, index: number): Set<number> | null {
  const spec = FIELDS[index];
  if (!spec) return null;
  const values = new Set<number>();
  for (const part of field.split(",")) {
    if (part.length === 0) return null;
    const expanded = expand(part, spec.min, spec.max);
    if (!expanded) return null;
    for (const value of expanded) values.add(value === 7 ? 0 : value);
  }
  return values.size > 0 ? values : null;
}

export function isValidCron(schedule: string): boolean {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field, index) => parseCronField(field, index) !== null);
}

/** Whether the schedule fires in the given minute (seconds ignored). */
export function isDueAt(schedule: string, date: Date): boolean {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const parsed = fields.map((field, index) => parseCronField(field, index));
  if (parsed.some((field) => field === null)) return false;
  const [minute, hour, day, month, weekday] = parsed as Set<number>[];
  return (
    minute.has(date.getMinutes()) &&
    hour.has(date.getHours()) &&
    day.has(date.getDate()) &&
    month.has(date.getMonth() + 1) &&
    weekday.has(date.getDay())
  );
}
