import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSafeModuleSql,
  manifestSchema,
  sha256,
  type ModuleManifest,
} from "./manifest";

const UP = "create table items (id int primary key);";
const DOWN = "drop table if exists items;";

function validManifest(overrides: Record<string, unknown> = {}): unknown {
  return {
    key: "demo-module",
    name: "Demo",
    branding: { description: "Demo module", icon: "assets/icon.svg", color: "teal" },
    version: "1.0.0",
    is_public: false,
    migrations: [
      { version: "1.0.0", up: UP, down: DOWN, digest: sha256(UP), down_digest: sha256(DOWN) },
    ],
    settings: [
      {
        category: "demo_module",
        label: "Demo",
        sort_order: 10,
        settings: [
          {
            key: "enabled",
            type: "bool",
            default: true,
            label: "Enabled",
            is_public: true,
            is_secret: false,
            mcp_access: "read",
            sort_order: 10,
          },
        ],
      },
    ],
    i18n: ["en"],
    scopes: ["demo:read"],
    mcp_tools: [
      { name: "items_list", kind: "read", description: "List items", scopes: ["demo:read"] },
    ],
    docs: { readme: "README.md", api: "docs/api.md", mcp: "docs/mcp.md", settings: "docs/settings.md" },
    ...overrides,
  };
}

describe("manifest contract", () => {
  it("accepts a valid manifest and applies optional defaults", () => {
    const parsed = manifestSchema.parse(validManifest());
    expect(parsed.key).toBe("demo-module");
    expect(parsed.channels).toEqual([]);
    expect(parsed.hooks).toEqual({});
  });

  it("rejects reserved keys, bad categories and duplicate migrations", () => {
    expect(() => manifestSchema.parse(validManifest({ key: "admin" }))).toThrow();
    expect(() =>
      manifestSchema.parse(
        validManifest({
          settings: [{ category: "wrong", label: "Demo", sort_order: 10, settings: [] }],
        }),
      ),
    ).toThrow();
    expect(() =>
      manifestSchema.parse(
        validManifest({
          migrations: [
            { version: "1.0.0", up: UP, down: DOWN, digest: sha256(UP), down_digest: sha256(DOWN) },
            { version: "1.0.0", up: UP, down: DOWN, digest: sha256(UP), down_digest: sha256(DOWN) },
          ],
        }),
      ),
    ).toThrow();
  });

  it("requires docs by capability and scopes declared by tools", () => {
    expect(() => manifestSchema.parse(validManifest({ docs: { readme: "README.md" } }))).toThrow();
    expect(() =>
      manifestSchema.parse(
        validManifest({
          scopes: [],
          mcp_tools: [{ name: "x", kind: "read", description: "X", scopes: ["demo:read"] }],
        }),
      ),
    ).toThrow();
  });

  it("rejects secret defaults and unsafe SQL", () => {
    expect(() =>
      manifestSchema.parse(
        validManifest({
          settings: [
            {
              category: "demo_module",
              label: "Demo",
              sort_order: 10,
              settings: [
                {
                  key: "token",
                  type: "string",
                  default: "leak",
                  label: "Token",
                  is_public: false,
                  is_secret: true,
                  mcp_access: "none",
                  sort_order: 10,
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow();

    expect(() => assertSafeModuleSql("create table public.items (id int);", "demo-module")).toThrow();
    expect(() => assertSafeModuleSql("create role attacker;", "demo-module")).toThrow();
    expect(() => assertSafeModuleSql("grant all on schema x to y;", "demo-module")).toThrow();
    expect(() => assertSafeModuleSql("set search_path to public;", "demo-module")).toThrow();
    expect(() => assertSafeModuleSql("create table items (id int);", "demo-module")).not.toThrow();
    expect(() =>
      assertSafeModuleSql("create table module_other.items (id int);", "demo-module"),
    ).toThrow(/another module/);
    expect(() =>
      assertSafeModuleSql("do $$ begin execute 'drop table items'; end $$;", "demo-module"),
    ).toThrow(/forbidden/);
  });

  it("rejects path traversal in migration files", () => {
    expect(() =>
      manifestSchema.parse(
        validManifest({
          migrations: [
            {
              version: "1.0.0",
              up: "./../../etc/passwd",
              down: DOWN,
              digest: sha256(UP),
              down_digest: sha256(DOWN),
            },
          ],
        }),
      ),
    ).toThrow();
  });
});

/**
 * CI check: every packaged manifest is valid, its docs/pages/icon exist and
 * cover every declared name, and the digests match the packaged SQL.
 */
describe("packaged module manifests (CI)", () => {
  const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
  const packagesDir = join(repoRoot, "packages");
  const candidates = readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesDir, entry.name, "manifest.json"))
    .filter((path) => existsSync(path));

  it("scans the packages directory", () => {
    expect(Array.isArray(candidates)).toBe(true);
  });

  for (const path of candidates) {
    const name = path.slice(repoRoot.length);
    it(`validates ${name}`, () => {
      const manifest = manifestSchema.parse(JSON.parse(readFileSync(path, "utf8"))) as ModuleManifest;
      const root = join(path, "..");

      const readDoc = (file: string | undefined, label: string): string => {
        if (!file) return "";
        const docPath = join(root, file);
        expect(existsSync(docPath), `${label} is missing: ${file}`).toBe(true);
        const content = readFileSync(docPath, "utf8");
        expect(content.trim().length, `${label} is empty: ${file}`).toBeGreaterThan(0);
        return content;
      };

      const readme = readDoc(manifest.docs.readme, "readme");
      expect(readme.trim().length).toBeGreaterThan(0);
      const api = readDoc(manifest.docs.api, "api docs");
      for (const scope of manifest.scopes) expect(api).toContain(scope);
      const mcp = readDoc(manifest.docs.mcp, "mcp docs");
      for (const tool of manifest.mcp_tools) expect(mcp).toContain(tool.name);
      const settings = readDoc(manifest.docs.settings, "settings docs");
      for (const group of manifest.settings) {
        for (const setting of group.settings) expect(settings).toContain(setting.key);
      }
      const events = readDoc(manifest.docs.events, "events docs");
      for (const event of manifest.events) expect(events).toContain(event.type);
      for (const channel of manifest.channels) expect(events).toContain(channel.pattern);

      for (const page of manifest.admin_pages) {
        expect(existsSync(join(root, "admin", page.route, "page.tsx"))).toBe(true);
      }
      expect(existsSync(join(root, manifest.branding.icon))).toBe(true);
      const icon = readFileSync(join(root, manifest.branding.icon), "utf8");
      expect(icon).toMatch(/<svg[\s>]/i);
      expect(icon).toContain("currentColor");

      for (const migration of manifest.migrations) {
        const content = migration.up.startsWith("./")
          ? readFileSync(join(root, migration.up.slice(2)), "utf8")
          : migration.up;
        expect(sha256(content)).toBe(migration.digest);
        const down = migration.down.startsWith("./")
          ? readFileSync(join(root, migration.down.slice(2)), "utf8")
          : migration.down;
        expect(sha256(down)).toBe(migration.down_digest);
      }
    });
  }
});
