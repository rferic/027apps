/**
 * Structured one-line JSON logs. Correlation only: no bodies, no PII, no
 * secrets. Callers pass fields that are already clean; unknown fields are
 * dropped so an accidental `email`/`ip` never reaches the log.
 */
export interface JsonLogEntry {
  ts: string;
  level: "info" | "warn" | "error";
  msg: string;
  request_id?: string;
  route?: string;
  status?: number;
  duration_ms?: number;
  actor?: string;
  code?: string;
}

const KEYS = [
  "ts",
  "level",
  "msg",
  "request_id",
  "route",
  "status",
  "duration_ms",
  "actor",
  "code",
] as const;

/** Serializes a log entry as one line, with stable key order and escaped values. */
export function serializeLog(entry: JsonLogEntry): string {
  const ordered: Record<string, unknown> = {};
  for (const key of KEYS) {
    const value = entry[key];
    if (value !== undefined) ordered[key] = value;
  }
  return JSON.stringify(ordered);
}
