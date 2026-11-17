import { describe, expect, it } from "vitest";
import { RECOVERY_COPY } from "./recovery-catalog";
import { EMAIL_LOCALES } from "./types";

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

describe("recovery copy catalog", () => {
  const english = RECOVERY_COPY.en;
  const keys = Object.keys(english).sort();

  it("covers every supported locale", () => {
    expect(Object.keys(RECOVERY_COPY).sort()).toEqual([...EMAIL_LOCALES].sort());
  });

  it("has the same keys in every locale", () => {
    for (const locale of EMAIL_LOCALES) {
      expect(Object.keys(RECOVERY_COPY[locale]).sort(), locale).toEqual(keys);
    }
  });

  it("keeps the placeholders of the English copy", () => {
    for (const locale of EMAIL_LOCALES) {
      for (const key of keys) {
        const expected = placeholders(english[key as keyof typeof english]);
        const actual = placeholders(RECOVERY_COPY[locale][key as keyof typeof english]);
        expect(actual, `${locale}.${key}`).toEqual(expected);
      }
    }
  });

  it("writes a subject for every locale", () => {
    for (const locale of EMAIL_LOCALES) {
      expect(RECOVERY_COPY[locale].subject.length, locale).toBeGreaterThan(4);
    }
  });
});
