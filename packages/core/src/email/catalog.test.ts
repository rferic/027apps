import { describe, expect, it } from "vitest";
import { EMAIL_COPY } from "./catalog";
import { EMAIL_LOCALES } from "./types";

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

describe("email copy catalog", () => {
  const english = EMAIL_COPY.en;
  const keys = Object.keys(english).sort();

  it("covers every supported locale", () => {
    expect(Object.keys(EMAIL_COPY).sort()).toEqual([...EMAIL_LOCALES].sort());
  });

  it("has the same keys in every locale", () => {
    for (const locale of EMAIL_LOCALES) {
      expect(Object.keys(EMAIL_COPY[locale]).sort(), locale).toEqual(keys);
    }
  });

  it("keeps the placeholders of the English copy", () => {
    for (const locale of EMAIL_LOCALES) {
      for (const key of keys) {
        const expected = placeholders(english[key as keyof typeof english]);
        const actual = placeholders(EMAIL_COPY[locale][key as keyof typeof english]);
        expect(actual, `${locale}.${key}`).toEqual(expected);
      }
    }
  });

  it("writes a subject for every locale", () => {
    for (const locale of EMAIL_LOCALES) {
      expect(EMAIL_COPY[locale].subject.length, locale).toBeGreaterThan(4);
    }
  });
});
