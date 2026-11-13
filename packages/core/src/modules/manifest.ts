import { createHash } from "node:crypto";
import { z } from "zod";
import { isValidCron } from "./cron";
import { DomainError } from "../errors";

/**
 * Module manifest contract (module-system spec §3). This is the mechanical
 * gate: the installer and CI validate the same schema. Scopes live in code;
 * the manifest only declares them so the guard and CI can check consistency.
 */

export const MODULE_KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const RESERVED_MODULE_KEYS = new Set(["admin", "mcp", "api", "core"]);
export const MODULE_COLORS = [
  "teal",
  "indigo",
  "violet",
  "amber",
  "rose",
  "emerald",
  "sky",
  "slate",
] as const;
export const MODULE_LOCALES = ["en", "es", "ca", "it", "fr", "de", "pt", "gl", "eu"] as const;

const SEMVER = /^\d+\.\d+\.\d+$/;
const SNAKE = /^[a-z][a-z0-9_]*$/;
const SCOPE = /^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9_]{1,32}$/;
const ROUTE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RESERVED_ROUTES = new Set(["admin", "mcp", "api", "settings", "users", "modules"]);
const RELATIVE_FILE = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._/-]+$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const FUNCTION_NAME = /^[a-z][a-z0-9_]{0,62}$/;
const CHANNEL_PATTERN = /^[a-z0-9][a-z0-9-]*(\{[a-z_]+\})?$/;

const sqlOrPath = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith("./") || RELATIVE_FILE.test(value.slice(2)), {
    message: "invalid module file path",
  });

const migrationSchema = z
  .object({
    version: z.string().regex(SEMVER),
    up: sqlOrPath,
    down: sqlOrPath,
    digest: z.string().regex(DIGEST),
    down_digest: z.string().regex(DIGEST),
  })
  .strict();

const settingSchema = z
  .object({
    key: z.string().regex(SNAKE),
    type: z.enum(["string", "int", "bool", "currency", "locale", "url", "json"]),
    default: z.unknown().optional(),
    label: z.string().trim().min(1),
    help: z.string().trim().min(1).optional(),
    /** Numeric range, only meaningful for `int` (D3.7). */
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    step: z.number().positive().optional(),
    /** How the panel renders it; `slider` requires `min` and `max`. */
    control: z.enum(["number", "slider"]).optional(),
    is_public: z.boolean(),
    is_secret: z.boolean(),
    mcp_access: z.enum(["none", "read", "write"]),
    sort_order: z.number().int().min(0),
  })
  .strict()
  .refine((setting) => !(setting.is_secret && setting.default !== undefined), {
    message: "a secret setting cannot declare a default in the public manifest",
  })
  .refine((setting) => !(setting.is_secret && setting.is_public), {
    message: "a secret setting cannot be public",
  })
  .superRefine((setting, ctx) => {
    const ranged =
      setting.min !== undefined ||
      setting.max !== undefined ||
      setting.step !== undefined ||
      setting.control !== undefined;
    if (ranged && setting.type !== "int") {
      ctx.addIssue({
        code: "custom",
        path: ["type"],
        message: "only an int setting declares min, max, step or control",
      });
      return;
    }
    if (setting.min !== undefined && setting.max !== undefined && setting.min > setting.max) {
      ctx.addIssue({ code: "custom", path: ["min"], message: "min cannot be greater than max" });
    }
    if (setting.control === "slider" && (setting.min === undefined || setting.max === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["control"],
        message: "a slider needs min and max",
      });
    }
    if (setting.default === undefined || setting.default === null) return;
    if (setting.type !== "int" || !Number.isInteger(setting.default)) return;
    const value = setting.default as number;
    if (setting.min !== undefined && value < setting.min) {
      ctx.addIssue({ code: "custom", path: ["default"], message: "default is below min" });
    }
    if (setting.max !== undefined && value > setting.max) {
      ctx.addIssue({ code: "custom", path: ["default"], message: "default is above max" });
    }
    if (setting.step !== undefined && (value - (setting.min ?? 0)) % setting.step !== 0) {
      ctx.addIssue({ code: "custom", path: ["default"], message: "default is off the step" });
    }
  });

const settingsCategorySchema = z
  .object({
    category: z.string().regex(SNAKE),
    label: z.string().trim().min(1),
    icon: z.string().trim().min(1).optional(),
    sort_order: z.number().int().min(0),
    settings: z.array(settingSchema),
  })
  .strict();

const mcpToolSchema = z
  .object({
    name: z.string().regex(FUNCTION_NAME),
    kind: z.enum(["read", "write"]),
    description: z.string().trim().min(1),
    scopes: z.array(z.string().regex(SCOPE)).min(1),
  })
  .strict();

const channelSchema = z
  .object({
    pattern: z.string().regex(CHANNEL_PATTERN),
    members_fn: z.string().regex(FUNCTION_NAME),
  })
  .strict();

const eventSchema = z
  .object({
    type: z.string().regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/),
    target: z.string().min(1),
    notify: z.array(z.enum(["push"])).optional(),
  })
  .strict();

const adminPageSchema = z
  .object({
    route: z.string().regex(ROUTE),
    label: z.string().trim().min(1),
    icon: z.string().trim().min(1),
    group: z.literal("module"),
    role: z.enum(["admin", "super_admin"]),
  })
  .strict();

const dashboardWidgetSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_]*$/),
    type: z.enum(["summary", "metric", "list"]),
    surface: z.enum(["app", "panel"]),
    title: z.string().trim().min(1),
    icon: z.string().trim().min(1),
    order: z.number().int().min(0),
    /** Function in the module schema: `(user_id uuid) returns jsonb`. */
    data_fn: z.string().regex(FUNCTION_NAME),
  })
  .strict();

const demoHooksSchema = z
  .object({
    seed_fn: z.string().regex(FUNCTION_NAME),
    clear_fn: z.string().regex(FUNCTION_NAME),
  })
  .strict();

const appActionSchema = z
  .object({
    key: z.string().regex(SNAKE),
    label: z.string().trim().min(1),
    icon: z.string().trim().min(1),
    screen: z.string().regex(/^[a-z][a-z0-9_]*$/),
  })
  .strict();

const moduleJobSchema = z
  .object({
    key: z.string().regex(SNAKE),
    schedule: z
      .string()
      .trim()
      .refine(isValidCron, { message: "schedule must be a 5-field cron expression" }),
    fn: z.string().regex(FUNCTION_NAME),
    timeout_seconds: z.number().int().min(1).max(300).default(30),
  })
  .strict();

const moduleRequirementSchema = z
  .object({
    key: z.string().regex(MODULE_KEY),
    version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
  })
  .strict();

const docsSchema = z
  .object({
    readme: z.string().regex(RELATIVE_FILE),
    api: z.string().regex(RELATIVE_FILE).optional(),
    mcp: z.string().regex(RELATIVE_FILE).optional(),
    settings: z.string().regex(RELATIVE_FILE).optional(),
    events: z.string().regex(RELATIVE_FILE).optional(),
  })
  .strict();

export const manifestSchema = z
  .object({
    key: z.string().regex(MODULE_KEY),
    name: z.string().trim().min(1),
    branding: z
      .object({
        description: z.string().trim().min(1),
        icon: z.string().regex(/^assets\/.+\.svg$/),
        color: z.enum(MODULE_COLORS),
      })
      .strict(),
    version: z.string().regex(SEMVER),
    contract: z.number().int().min(1),
    is_public: z.boolean(),
    migrations: z.array(migrationSchema).default([]),
    settings: z.array(settingsCategorySchema).default([]),
    i18n: z.array(z.enum(MODULE_LOCALES)),
    scopes: z.array(z.string().regex(SCOPE)).default([]),
    mcp_tools: z.array(mcpToolSchema).default([]),
    channels: z.array(channelSchema).default([]),
    events: z.array(eventSchema).default([]),
    hooks: z.record(z.string(), z.string().regex(FUNCTION_NAME)).default({}),
    admin_pages: z.array(adminPageSchema).default([]),
    dashboard_widgets: z.array(dashboardWidgetSchema).default([]),
    demo: demoHooksSchema.optional(),
    app: z
      .object({ visible: z.boolean() })
      .strict()
      .default({ visible: true }),
    requires: z.array(moduleRequirementSchema).default([]),
    jobs: z.array(moduleJobSchema).default([]),
    app_actions: z.array(appActionSchema).default([]),
    docs: docsSchema,
  })
  .strict()
  .superRefine((manifest, ctx) => {
    if (RESERVED_MODULE_KEYS.has(manifest.key)) {
      ctx.addIssue({ code: "custom", path: ["key"], message: "reserved module key" });
    }
    const versions = manifest.migrations.map((migration) => migration.version);
    if (new Set(versions).size !== versions.length) {
      ctx.addIssue({ code: "custom", path: ["migrations"], message: "duplicate migration version" });
    }
    for (const category of manifest.settings) {
      const expected = manifest.key.replace(/-/g, "_");
      if (category.category !== expected) {
        ctx.addIssue({
          code: "custom",
          path: ["settings", category.category],
          message: "settings category must be snake_case(key)",
        });
      }
      const keys = category.settings.map((setting) => setting.key);
      if (new Set(keys).size !== keys.length) {
        ctx.addIssue({
          code: "custom",
          path: ["settings", category.category],
          message: "duplicate setting key",
        });
      }
    }
    const scopes = new Set(manifest.scopes);
    for (const tool of manifest.mcp_tools) {
      for (const scope of tool.scopes) {
        if (!scopes.has(scope)) {
          ctx.addIssue({
            code: "custom",
            path: ["mcp_tools", tool.name],
            message: `tool scope ${scope} is not declared in scopes`,
          });
        }
      }
    }
    const toolNames = manifest.mcp_tools.map((tool) => tool.name);
    if (new Set(toolNames).size !== toolNames.length) {
      ctx.addIssue({ code: "custom", path: ["mcp_tools"], message: "duplicate tool name" });
    }
    const channelPatterns = new Set(manifest.channels.map((channel) => channel.pattern));
    for (const event of manifest.events) {
      if (event.target.startsWith("channel:")) {
        const pattern = event.target.slice("channel:".length);
        if (!channelPatterns.has(pattern)) {
          ctx.addIssue({
            code: "custom",
            path: ["events", event.type],
            message: "channel target has no declared channel pattern",
          });
        }
      }
    }
    for (const requirement of manifest.requires) {
      if (requirement.key === manifest.key) {
        ctx.addIssue({
          code: "custom",
          path: ["requires", requirement.key],
          message: "a module cannot require itself",
        });
      }
    }
    const requiredKeys = manifest.requires.map((requirement) => requirement.key);
    if (new Set(requiredKeys).size !== requiredKeys.length) {
      ctx.addIssue({ code: "custom", path: ["requires"], message: "duplicate requirement" });
    }
    if (manifest.app_actions.length > 0 && !manifest.app.visible) {
      ctx.addIssue({
        code: "custom",
        path: ["app_actions"],
        message: "a background module (app.visible: false) cannot declare app actions",
      });
    }
    const actionKeys = manifest.app_actions.map((action) => action.key);
    if (new Set(actionKeys).size !== actionKeys.length) {
      ctx.addIssue({ code: "custom", path: ["app_actions"], message: "duplicate app action key" });
    }
    const jobKeys = manifest.jobs.map((job) => job.key);
    if (new Set(jobKeys).size !== jobKeys.length) {
      ctx.addIssue({ code: "custom", path: ["jobs"], message: "duplicate job key" });
    }
    const widgetKeys = manifest.dashboard_widgets.map((widget) => widget.key);
    if (new Set(widgetKeys).size !== widgetKeys.length) {
      ctx.addIssue({
        code: "custom",
        path: ["dashboard_widgets"],
        message: "duplicate widget key",
      });
    }
    const routes = manifest.admin_pages.map((page) => page.route);
    if (new Set(routes).size !== routes.length) {
      ctx.addIssue({ code: "custom", path: ["admin_pages"], message: "duplicate admin route" });
    }
    for (const page of manifest.admin_pages) {
      if (RESERVED_ROUTES.has(page.route)) {
        ctx.addIssue({
          code: "custom",
          path: ["admin_pages", page.route],
          message: "reserved admin route",
        });
      }
    }
    if (!manifest.i18n.includes("en")) {
      ctx.addIssue({ code: "custom", path: ["i18n"], message: "i18n must include en" });
    }
    // Documentation is mandatory by capability (module-system spec §3/§6).
    if (!manifest.docs.readme) {
      ctx.addIssue({ code: "custom", path: ["docs", "readme"], message: "readme is required" });
    }
    if (manifest.scopes.length > 0 && !manifest.docs.api) {
      ctx.addIssue({ code: "custom", path: ["docs", "api"], message: "api docs are required" });
    }
    if (manifest.mcp_tools.length > 0 && !manifest.docs.mcp) {
      ctx.addIssue({ code: "custom", path: ["docs", "mcp"], message: "mcp docs are required" });
    }
    if (manifest.settings.length > 0 && !manifest.docs.settings) {
      ctx.addIssue({ code: "custom", path: ["docs", "settings"], message: "settings docs are required" });
    }
    if (
      (manifest.events.length > 0 || manifest.channels.length > 0) &&
      !manifest.docs.events
    ) {
      ctx.addIssue({ code: "custom", path: ["docs", "events"], message: "events docs are required" });
    }
  });

export type ModuleManifest = z.infer<typeof manifestSchema>;

export function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function manifestDigest(manifest: ModuleManifest): string {
  return sha256(JSON.stringify(manifest));
}

/**
 * Defence in depth for module DDL (module-system spec §5). The installer runs
 * it as a restricted, non-superuser role scoped to `module_<key>`; this check
 * rejects obvious escapes before the engine sees them.
 */
export function assertSafeModuleSql(sql: string, moduleKey: string): void {
  const schema = `module_${moduleKey.replace(/-/g, "_")}`;
  // Two audited public references are allowed: the identity helper the Core
  // exposes for RLS, and `profiles` as a foreign-key target (never as a read).
  // Everything else in `public` stays forbidden.
  const audited = sql
    .replace(/public\s*\.\s*core_current_user_id\s*\(/gi, "core_current_user_id(")
    .replace(/references\s+public\s*\.\s*profiles\s*\(/gi, "references profiles(");
  const forbiddenSchema = /\b(auth|storage|realtime|extensions|vault|pg_catalog|information_schema|supabase_migrations)\s*\./i;
  if (forbiddenSchema.test(audited)) throw new Error(`module SQL may not reference reserved schemas (${schema})`);
  if (/\bpublic\s*\./i.test(audited)) throw new Error("module SQL may not reference the public schema");
  // A module may only touch its own schema, never another module's.
  for (const match of sql.matchAll(/\bmodule_([a-z0-9_]+)\s*\./gi)) {
    if (`module_${match[1]}` !== schema) throw new Error("module SQL may not reference another module schema");
  }

  const forbiddenKeywords = [
    /\bcreate\s+(or\s+replace\s+)?(role|database|extension|schema)\b/i,
    /\balter\s+(role|database|system)\b/i,
    /\bdrop\s+schema\b/i,
    /\bgrant\b/i,
    /\brevoke\b/i,
    /\b(set|reset)\s+(local\s+|session\s+)?role\b/i,
    /\bset\s+(local\s+|session\s+)?search_path\b/i,
    /\bcopy\b/i,
    /\btruncate\s+public\b/i,
    /\bdo\b/i,
    /\bexecute\b/i,
    /\bsecurity\s+definer\b/i,
  ];
  for (const pattern of forbiddenKeywords) {
    if (pattern.test(sql)) throw new Error("module SQL contains a forbidden statement");
  }
}

export function validateManifest(value: unknown): ModuleManifest {
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new DomainError("validation_failed", "Invalid module manifest", parsed.error.flatten());
  }
  return parsed.data;
}
