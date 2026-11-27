import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { assertSafeModuleSql, validateManifest } from "@027apps/core/modules/manifest.js";

/**
 * The package contract (docs/ai/module-system.md): the manifest validates, its
 * digests match the SQL on disk, the SQL is safe for the installer, and every
 * declaration points at a file or a name that exists.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = ["en", "es", "ca", "it", "fr", "de", "pt", "gl", "eu"];

type Manifest = {
  key: string;
  version: string;
  contract: number;
  is_public: boolean;
  branding: { color: string; icon: string; description: string };
  migrations: { version: string; up: string; down: string; digest: string; down_digest: string }[];
  settings: { category: string; settings: { key: string }[] }[];
  scopes: string[];
  events: { type: string; target: string }[];
  channels: { pattern: string; members_fn: string }[];
  i18n: string[];
  docs: Record<string, string>;
};

let raw: string;
let manifest: Manifest;

beforeAll(async () => {
  raw = await readFile(resolve(ROOT, "manifest.json"), "utf8");
  manifest = JSON.parse(raw) as Manifest;
});

const sha = (file: string) =>
  `sha256:${createHash("sha256").update(readFileSync(resolve(ROOT, file))).digest("hex")}`;

describe("todo manifest", () => {
  it("validates against the Core contract", () => {
    const parsed = validateManifest(JSON.parse(raw));
    expect(parsed.key).toBe("todo");
    expect(parsed.contract).toBe(1);
    expect(parsed.is_public).toBe(true);
    expect(parsed.branding.color).toBe("indigo");
  });

  it("declares a version and the icon the branding points at", () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(existsSync(resolve(ROOT, manifest.branding.icon))).toBe(true);
    expect(manifest.branding.description.trim().length).toBeGreaterThan(0);
  });

  it("matches every declared digest to the SQL on disk", () => {
    for (const migration of manifest.migrations) {
      expect(sha(migration.up), `${migration.version} up`).toBe(migration.digest);
      expect(sha(migration.down), `${migration.version} down`).toBe(migration.down_digest);
    }
  });

  it("keeps the SQL within what the installer allows", async () => {
    for (const migration of manifest.migrations) {
      for (const file of [migration.up, migration.down]) {
        const sql = await readFile(resolve(ROOT, file), "utf8");
        expect(() => assertSafeModuleSql(sql, manifest.key), file).not.toThrow();
      }
    }
  });

  it("points every capability document at a real file", () => {
    for (const [capability, file] of Object.entries(manifest.docs)) {
      const path = resolve(ROOT, file);
      expect(existsSync(path), `${capability}: ${file}`).toBe(true);
      expect(statSync(path).size, `${capability}: ${file}`).toBeGreaterThan(0);
    }
  });

  it("uses the module key as the settings category", () => {
    for (const category of manifest.settings) {
      expect(category.category).toBe("todo");
    }
  });

  it("targets declared channels and keeps scopes well formed", () => {
    const patterns = manifest.channels.map((channel) => channel.pattern);
    for (const event of manifest.events) {
      if (!event.target.startsWith("channel:")) continue;
      const pattern = event.target.slice("channel:".length);
      expect(patterns, event.type).toContain(pattern);
    }
    for (const scope of manifest.scopes) {
      expect(scope).toMatch(/^[a-z][a-z_]*:[a-z_]+$/);
    }
  });

  it("ships all nine locales", () => {
    expect([...manifest.i18n].sort()).toEqual([...LOCALES].sort());
    for (const locale of manifest.i18n) {
      expect(existsSync(resolve(ROOT, "locales", `${locale}.json`)), locale).toBe(true);
    }
  });
});
