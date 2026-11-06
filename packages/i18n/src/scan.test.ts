import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractStrings, mergeCatalog, scanSources, writeCatalog } from "./scan.js";

describe("extractStrings", () => {
  it("extracts double- and single-quoted t() calls", () => {
    expect(extractStrings('const a = t("Email"); const b = t(\'Password\');')).toEqual([
      "Email",
      "Password",
    ]);
  });

  it("ignores it(), expect.t() and identifiers ending in t", () => {
    expect(extractStrings('it("Email"); expect.t("Email"); submit("Email");')).toEqual([]);
  });

  it("ignores dynamic expressions and template literals", () => {
    expect(extractStrings("t(variable); t(`Email`); t();")).toEqual([]);
  });
});

describe("scanSources", () => {
  it("scans ts/tsx, skips tests and node_modules, dedupes and sorts", () => {
    const dir = mkdtempSync(join(tmpdir(), "i18n-scan-"));
    mkdirSync(join(dir, "nested"));
    writeFileSync(join(dir, "a.tsx"), 'export const a = t("Email");');
    writeFileSync(join(dir, "nested", "b.ts"), 'export const b = t("Password");');
    writeFileSync(join(dir, "c.test.tsx"), 'it("Ignored");');
    mkdirSync(join(dir, "node_modules"));
    writeFileSync(join(dir, "node_modules", "d.ts"), 't("Ignored");');

    expect(scanSources(dir)).toEqual(["Email", "Password"]);
  });
});

describe("mergeCatalog", () => {
  it("preserves pre-seeded keys, adds found keys, dedupes and sorts", () => {
    expect(mergeCatalog(["Seed B", "Shared", "Seed A"], ["Found", "Shared"])).toEqual([
      "Found",
      "Seed A",
      "Seed B",
      "Shared",
    ]);
  });
});

describe("writeCatalog", () => {
  it("writes sorted unique keys with 2 spaces and a final newline", () => {
    const file = join(mkdtempSync(join(tmpdir(), "i18n-catalog-")), "catalog.en.json");

    writeCatalog(file, ["B", "A", "B"]);

    expect(readFileSync(file, "utf8")).toBe('[\n  "A",\n  "B"\n]\n');
  });
});
