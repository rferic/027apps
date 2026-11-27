import { describe, expect, it } from "vitest";
import { localDate, nextPeriod, periodEnded, periodFor } from "./recurrence.js";

describe("weekly periods", () => {
  it("runs Monday to Sunday", () => {
    // 2026-11-27 is a Friday.
    expect(periodFor("weekly", "2026-11-27")).toEqual({
      start: "2026-11-23",
      end: "2026-11-29",
    });
    // A Sunday belongs to the week that started six days before.
    expect(periodFor("weekly", "2026-11-29")).toEqual({
      start: "2026-11-23",
      end: "2026-11-29",
    });
    // A Monday starts a new one.
    expect(periodFor("weekly", "2026-11-30")).toEqual({
      start: "2026-11-30",
      end: "2026-12-06",
    });
  });

  it("walks to the next period across the end of the year", () => {
    expect(nextPeriod("weekly", "2026-12-27")).toEqual({
      start: "2026-12-28",
      end: "2027-01-03",
    });
  });
});

describe("monthly periods", () => {
  it("covers the whole month, February included", () => {
    expect(periodFor("monthly", "2026-11-14")).toEqual({
      start: "2026-11-01",
      end: "2026-11-30",
    });
    expect(periodFor("monthly", "2024-02-10")).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    });
    expect(periodFor("monthly", "2100-02-10")).toEqual({
      start: "2100-02-01",
      end: "2100-02-28",
    });
  });

  it("moves into the next month, including a 31st into a 30-day one", () => {
    expect(nextPeriod("monthly", "2026-11-30")).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
    });
    expect(nextPeriod("monthly", "2026-12-31")).toEqual({
      start: "2027-01-01",
      end: "2027-01-31",
    });
  });
});

describe("yearly periods", () => {
  it("is the calendar year", () => {
    expect(periodFor("yearly", "2026-06-15")).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
    });
    expect(nextPeriod("yearly", "2026-12-31")).toEqual({
      start: "2027-01-01",
      end: "2027-12-31",
    });
  });
});

describe("the group's timezone decides the day", () => {
  it("reads the local date, not the UTC one", () => {
    // 23:30 UTC on the 27th is already the 28th in Madrid.
    const at = new Date("2026-11-27T23:30:00Z");
    expect(localDate(at, "Europe/Madrid")).toBe("2026-11-28");
    expect(localDate(at, "Europe/Madrid")).not.toBe(localDate(at, "UTC"));
  });

  it("moves the period at local midnight, not UTC midnight", () => {
    const period = periodFor("weekly", "2026-11-23");
    // Sunday 23:30 UTC is already Monday 00:30 in Madrid: the week has ended there.
    expect(periodEnded(period, new Date("2026-11-29T23:30:00Z"), "Europe/Madrid")).toBe(true);
    expect(periodEnded(period, new Date("2026-11-29T23:30:00Z"), "UTC")).toBe(false);
  });

  it("survives a daylight saving change without skipping a week", () => {
    // Madrid springs forward on 2027-03-28; the weeks around it stay contiguous.
    const before = periodFor("weekly", "2027-03-22");
    const after = nextPeriod("weekly", before.end);
    expect(before).toEqual({ start: "2027-03-22", end: "2027-03-28" });
    expect(after).toEqual({ start: "2027-03-29", end: "2027-04-04" });
  });
});
