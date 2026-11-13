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
    contract: 1,
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

  it("validates the demo hooks as a pair", () => {
    const hooks = { seed_fn: "seed_demo", clear_fn: "clear_demo" };
    expect(() => manifestSchema.parse(validManifest({ demo: hooks }))).not.toThrow();
    expect(() =>
      manifestSchema.parse(validManifest({ demo: { seed_fn: "seed_demo" } })),
    ).toThrow();
    expect(() =>
      manifestSchema.parse(validManifest({ demo: { ...hooks, clear_fn: "ClearDemo" } })),
    ).toThrow();
  });

  it("validates app actions and keeps them out of background modules", () => {
    const action = { key: "add_note", label: "Add note", icon: "plus", screen: "notes" };
    const withActions = (actions: unknown[], app = { visible: true }) =>
      validManifest({ app, app_actions: actions });

    expect(() => manifestSchema.parse(withActions([action]))).not.toThrow();
    expect(() => manifestSchema.parse(withActions([action, action]))).toThrow(/duplicate/);
    expect(() => manifestSchema.parse(withActions([{ ...action, screen: "Notes" }]))).toThrow();
    expect(() =>
      manifestSchema.parse(withActions([action], { visible: false })),
    ).toThrow(/background/);
  });

  it("validates scheduled jobs (cron, duplicate keys, timeout)", () => {
    const job = {
      key: "cleanup",
      schedule: "*/5 * * * *",
      fn: "job_cleanup",
      timeout_seconds: 30,
    };
    const withJobs = (jobs: unknown[]) => validManifest({ jobs });

    expect(() => manifestSchema.parse(withJobs([job]))).not.toThrow();
    expect(() => manifestSchema.parse(withJobs([{ ...job, schedule: "*/0 * * * *" }]))).toThrow();
    expect(() => manifestSchema.parse(withJobs([{ ...job, schedule: "every minute" }]))).toThrow();
    expect(() => manifestSchema.parse(withJobs([job, job]))).toThrow(/duplicate/);
    expect(() => manifestSchema.parse(withJobs([{ ...job, timeout_seconds: 0 }]))).toThrow();
    expect(() => manifestSchema.parse(withJobs([{ ...job, timeout_seconds: 301 }]))).toThrow();
  });

  it("validates dashboard widgets and their keys (D10)", () => {
    const widget = {
      key: "demo.summary",
      type: "summary",
      surface: "app",
      title: "Summary",
      icon: "chart",
      order: 10,
      data_fn: "widget_summary",
    };
    const withWidgets = (widgets: unknown[]) => validManifest({ dashboard_widgets: widgets });

    expect(() => manifestSchema.parse(withWidgets([widget]))).not.toThrow();
    expect(() => manifestSchema.parse(withWidgets([widget, widget]))).toThrow(/duplicate/);
    expect(() => manifestSchema.parse(withWidgets([{ ...widget, surface: "web" }]))).toThrow();
    expect(() => manifestSchema.parse(withWidgets([{ ...widget, type: "html" }]))).toThrow();
    expect(() => manifestSchema.parse(withWidgets([{ ...widget, key: "summary" }]))).toThrow();
    expect(() =>
      manifestSchema.parse(withWidgets([{ ...widget, data_fn: "Bad Name" }])),
    ).toThrow();
  });

  it("reserves the settings route for the module ficha (D20)", () => {
    expect(() =>
      manifestSchema.parse(
        validManifest({
          admin_pages: [
            { route: "settings", label: "Settings", icon: "gear", group: "module", role: "admin" },
          ],
        }),
      ),
    ).toThrow(/reserved/);
    expect(() =>
      manifestSchema.parse(
        validManifest({
          admin_pages: [
            { route: "overview", label: "Overview", icon: "chart", group: "module", role: "admin" },
          ],
        }),
      ),
    ).not.toThrow();
  });

  it("validates the range of an int setting (slider)", () => {
    const withSetting = (setting: Record<string, unknown>) =>
      validManifest({
        settings: [
          {
            category: "demo_module",
            label: "Demo",
            sort_order: 10,
            settings: [
              {
                key: "limit",
                type: "int",
                min: 4,
                max: 20,
                step: 1,
                control: "slider",
                default: 12,
                label: "Limit",
                is_public: false,
                is_secret: false,
                mcp_access: "read",
                sort_order: 10,
                ...setting,
              },
            ],
          },
        ],
      });

    expect(() => manifestSchema.parse(withSetting({}))).not.toThrow();
    // A range belongs to int only.
    expect(() => manifestSchema.parse(withSetting({ type: "string", default: "x" }))).toThrow();
    // min > max.
    expect(() => manifestSchema.parse(withSetting({ min: 21 }))).toThrow();
    // default out of range.
    expect(() => manifestSchema.parse(withSetting({ default: 21 }))).toThrow();
    // slider without min and max.
    expect(() => manifestSchema.parse(withSetting({ min: undefined, max: undefined }))).toThrow();
    // default off the step.
    expect(() => manifestSchema.parse(withSetting({ default: 13, step: 2 }))).toThrow();
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

  it("allows only the audited public references", () => {
    // The identity helper and the profiles FK target are the two exceptions.
    expect(() =>
      assertSafeModuleSql(
        "create policy notes_own on notes using (user_id = public.core_current_user_id());",
        "demo-module",
      ),
    ).not.toThrow();
    expect(() =>
      assertSafeModuleSql(
        "create table notes (user_id uuid references public.profiles(id) on delete set null);",
        "demo-module",
      ),
    ).not.toThrow();
    // Any other public reference stays forbidden.
    expect(() =>
      assertSafeModuleSql("select * from public.profiles;", "demo-module"),
    ).toThrow(/public schema/);
    expect(() =>
      assertSafeModuleSql("select * from public.settings;", "demo-module"),
    ).toThrow(/public schema/);
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
 * Drift guard: the JSON Schema agents write manifests against and the Zod
 * schema the installer validates with must declare the same top-level keys.
 * Renaming a key in only one of them ships an installable-looking contract
 * that rejects every manifest written from the docs (see module-system §8).
 */
describe("documented manifest schema (docs/ai/manifest.schema.json)", () => {
  const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
  const schemaPath = join(repoRoot, "docs/ai/manifest.schema.json");

  it("declares the same top-level properties as manifestSchema", () => {
    const jsonSchema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
      properties?: Record<string, unknown>;
    };
    const documented = Object.keys(jsonSchema.properties ?? {}).sort();
    const implemented = Object.keys(manifestSchema.shape).sort();

    const missingInDoc = implemented.filter((key) => !documented.includes(key));
    const missingInSchema = documented.filter((key) => !implemented.includes(key));

    expect(
      { missingInDoc, missingInSchema },
      "docs/ai/manifest.schema.json diverges from the Zod contract: " +
        `missing in doc=[${missingInDoc.join(", ")}] ` +
        `missing in code=[${missingInSchema.join(", ")}]. ` +
        "Update docs/ai/manifest.schema.json and docs/ai/module-system.md to match " +
        "packages/core/src/modules/manifest.ts.",
    ).toEqual({ missingInDoc: [], missingInSchema: [] });
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
