import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertSafeModuleSql, sha256, validateManifest } from "./manifest";

/**
 * Every package in the workspace must be installable as shipped: the manifest
 * validates, the digests match the SQL on disk and the docs by capability name
 * every scope, setting, event and channel. The installer repeats these checks,
 * so a broken package fails here before it reaches an instance.
 */
const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../packages");

function packages(): Array<{ key: string; dir: string }> {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ key: entry.name, dir: join(ROOT, entry.name) }))
    .filter((entry) => existsSync(join(entry.dir, "manifest.json")));
}

describe("module packages", () => {
  it("finds the packages this repository ships", () => {
    const keys = packages().map((entry) => entry.key);
    expect(keys).toContain("fixture");
    expect(keys).toContain("owe-no");
  });

  for (const { key, dir } of packages()) {
    it(`${key} validates, matches its SQL digests and documents every capability`, () => {
      const manifest = validateManifest(
        JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")),
      );
      expect(manifest.key).toBe(key);

      for (const migration of manifest.migrations) {
        const up = readFileSync(join(dir, migration.up), "utf8");
        const down = readFileSync(join(dir, migration.down), "utf8");
        expect(sha256(up)).toBe(migration.digest);
        expect(sha256(down)).toBe(migration.down_digest);
        expect(() => assertSafeModuleSql(up, key)).not.toThrow();
        expect(() => assertSafeModuleSql(down, key)).not.toThrow();
      }

      const read = (path: string) => readFileSync(join(dir, path), "utf8");
      expect(read(manifest.docs.readme).trim().length).toBeGreaterThan(0);
      if (manifest.docs.api) {
        const api = read(manifest.docs.api);
        for (const scope of manifest.scopes) expect(api).toContain(scope);
      }
      if (manifest.docs.settings) {
        const settings = read(manifest.docs.settings);
        for (const group of manifest.settings) {
          for (const setting of group.settings) expect(settings).toContain(setting.key);
        }
      }
      if (manifest.docs.events) {
        const events = read(manifest.docs.events);
        for (const event of manifest.events) expect(events).toContain(event.type);
        for (const channel of manifest.channels) expect(events).toContain(channel.pattern);
      }

      // A module that declares locales ships a flat map for each of them.
      for (const locale of manifest.i18n) {
        const path = join(dir, "locales", `${locale}.json`);
        expect(existsSync(path), `${key} has no locales/${locale}.json`).toBe(true);
        const copy = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
        for (const value of Object.values(copy)) expect(typeof value).toBe("string");
      }
    });
  }
});
