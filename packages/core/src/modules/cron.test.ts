import { describe, expect, it } from "vitest";
import { isDueAt, isValidCron, parseCronField } from "./cron";

describe("cron", () => {
  it("validates the five fields and their ranges", () => {
    expect(isValidCron("* * * * *")).toBe(true);
    expect(isValidCron("*/5 0-6 1,15 * 1-5")).toBe(true);
    expect(isValidCron("60 * * * *")).toBe(false);
    expect(isValidCron("* 24 * * *")).toBe(false);
    expect(isValidCron("* * 0 * *")).toBe(false);
    expect(isValidCron("* * * 13 *")).toBe(false);
    expect(isValidCron("* * * * 8")).toBe(false);
    expect(isValidCron("* * * *")).toBe(false);
    expect(isValidCron("*/0 * * * *")).toBe(false);
    expect(isValidCron("a * * * *")).toBe(false);
  });

  it("maps Sunday 7 to 0", () => {
    expect(parseCronField("7", 4)).toEqual(new Set([0]));
    expect(parseCronField("0", 4)).toEqual(new Set([0]));
  });

  it("fires only in the matching minute", () => {
    const date = new Date(Date.UTC(2026, 10, 13, 10, 5, 42));
    expect(isDueAt("5 10 * * *", date)).toBe(true);
    expect(isDueAt("*/5 * * * *", date)).toBe(true);
    expect(isDueAt("6 10 * * *", date)).toBe(false);
    expect(isDueAt("5 11 * * *", date)).toBe(false);
  });

  it("requires day-of-month and weekday to match together", () => {
    const friday13 = new Date(Date.UTC(2026, 10, 13, 9, 0, 0));
    expect(isDueAt("0 9 13 * 5", friday13)).toBe(true);
    expect(isDueAt("0 9 14 * 5", friday13)).toBe(false);
  });
});
