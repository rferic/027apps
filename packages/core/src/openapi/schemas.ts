import { z, type ZodType } from "zod";
import { DOMAIN_ERROR_CODES, type ErrorEnvelope } from "../errors";
import type { UserView } from "../users/service";
import type { CategoryDetail, CategoryMember, CategoryView } from "../user-categories/service";
import type { InvitationView, RedeemResult } from "../invitations/service";
import type { ApiKeyView } from "../api-keys/service";
import type { DeviceView } from "../devices/service";
import type { ModuleDetail, ModuleSettingView, ModuleView } from "../modules/service";
import type { SettingView } from "../settings/service";
import type { SettingCategoryMeta } from "../settings/catalog";
import type { CurrencyView } from "../currencies/service";
import type { MaintenanceResult } from "../maintenance/service";
import type { EnvironmentReport } from "../setup/environment";

/**
 * Named JSON Schemas for the OpenAPI document. Each one is tied to the service
 * view type with `satisfies`, so a response field that changes in the service
 * breaks the typecheck instead of drifting out of the published contract.
 */

const componentNames = new WeakMap<ZodType, string>();
const components: Array<{ name: string; schema: ZodType }> = [];
const componentOverrides = new Map<string, Record<string, unknown>>();

/** Registers `schema` under `name` for `components.schemas` and returns it unchanged. */
export function component<T extends ZodType>(name: string, schema: T): T {
  const existing = componentNames.get(schema);
  if (existing && existing !== name) {
    throw new Error(`Schema already registered as ${existing}`);
  }
  componentNames.set(schema, name);
  if (!existing) components.push({ name, schema });
  return schema;
}

/** Component name for `schema`, or `null` when it is used inline only. */
export function componentName(schema: ZodType): string | null {
  return componentNames.get(schema) ?? null;
}

/** Every registered component, in name order (deterministic output). */
export function namedComponents(): ReadonlyArray<{ name: string; schema: ZodType }> {
  return [...components].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Adds JSON Schema keywords that zod cannot express after a refinement (for
 * example `minProperties` for a "not empty" object). The patch is merged into
 * the emitted component, so the published contract keeps the runtime rule.
 */
export function overrideComponent(name: string, patch: Record<string, unknown>): void {
  componentOverrides.set(name, { ...(componentOverrides.get(name) ?? {}), ...patch });
}

/** JSON Schema patch for a component, or `undefined` when there is none. */
export function componentOverride(name: string): Record<string, unknown> | undefined {
  return componentOverrides.get(name);
}

const isoDate = z.iso.datetime();
const nullableDate = isoDate.nullable();
const role = z.enum(["super_admin", "admin", "user"]);

export const userCategoryRefSchema = component(
  "UserCategoryRef",
  z
    .object({
      id: z.uuid(),
      name: z.string(),
    })
    .strict(),
);

export const userSchema = component(
  "User",
  z
    .object({
      id: z.uuid(),
      display_name: z.string(),
      locale: z.string(),
      timezone: z.string(),
      role,
      created_at: isoDate,
      deactivated_at: nullableDate,
      categories: z.array(userCategoryRefSchema),
    })
    .strict() satisfies z.ZodType<UserView>,
);

export const userListSchema = component(
  "UserList",
  z
    .object({
      users: z.array(userSchema),
      total: z.number().int(),
      active_total: z.number().int(),
      limit: z.number().int(),
      offset: z.number().int(),
    })
    .strict(),
);

/** Query contract shared by every paginated list endpoint. */
export const paginationQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).optional().describe("Page size (1..100, default 20)."),
  offset: z.number().int().min(0).optional().describe("Rows to skip (default 0)."),
});

export const usersQuerySchema = paginationQuerySchema.extend({
  q: z.string().max(100).optional().describe("Filter by name or email."),
  role: z
    .enum(["super_admin", "admin", "user"])
    .optional()
    .describe("Filter by role."),
  state: z
    .enum(["active", "deactivated", "all"])
    .optional()
    .describe("Filter by activation state; omitted means active, all removes the filter."),
  category: z
    .uuid()
    .optional()
    .describe("Only members of this category id; the total reflects the filter."),
});

export const invitationsQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum(["pending", "used", "expired", "revoked", "all"])
    .optional()
    .describe("Filter by derived status; omitted or all removes the filter. total reflects it."),
});

export const apiKeysQuerySchema = paginationQuerySchema.extend({
  kind: z
    .enum(["all", "service", "delegated"])
    .optional()
    .describe("Filter by key kind; omitted or all removes the filter. total reflects it."),
  user: z
    .uuid()
    .optional()
    .describe(
      "Owner of delegated keys (super_admin only); rejected together with kind=service.",
    ),
  state: z
    .enum(["all", "active", "revoked", "expired"])
    .optional()
    .describe(
      "Filter by derived state; omitted or all removes the filter. A revoked key never counts as expired. total reflects it.",
    ),
});

export const userResponseSchema = component(
  "UserResponse",
  z.object({ user: userSchema }).strict(),
);

export const userModuleSchema = component(
  "UserModule",
  z.object({ key: z.string(), name: z.string() }).strict(),
);

export const userModulesResponseSchema = component(
  "UserModulesResponse",
  z.object({ modules: z.array(userModuleSchema) }).strict(),
);

export const categoryMemberSchema = component(
  "CategoryMember",
  z
    .object({ id: z.uuid(), display_name: z.string(), role: z.string() })
    .strict() satisfies z.ZodType<CategoryMember>,
);

export const categorySchema = component(
  "Category",
  z
    .object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
      created_at: isoDate,
      member_count: z.number().int(),
      modules: z.array(z.string()),
    })
    .strict() satisfies z.ZodType<CategoryView>,
);

export const categoryDetailSchema = component(
  "CategoryDetail",
  categorySchema
    .extend({ members: z.array(categoryMemberSchema) })
    .strict() satisfies z.ZodType<CategoryDetail>,
);

export const categoryListSchema = component(
  "CategoryList",
  z
    .object({
      categories: z.array(categorySchema),
      total: z.number().int(),
      limit: z.number().int(),
      offset: z.number().int(),
    })
    .strict(),
);

export const categoryResponseSchema = component(
  "CategoryResponse",
  z.object({ category: categorySchema }).strict(),
);

export const categoryDetailResponseSchema = component(
  "CategoryDetailResponse",
  z.object({ category: categoryDetailSchema }).strict(),
);

export const categoryModulesResponseSchema = component(
  "CategoryModulesResponse",
  z.object({ modules: z.array(z.string()) }).strict(),
);

export const invitationSchema = component(
  "Invitation",
  z
    .object({
      id: z.uuid(),
      email: z.email(),
      name: z.string(),
      user_category_id: z.uuid().nullable(),
      modules: z.array(z.string()),
      status: z.enum(["pending", "used", "expired", "revoked"]),
      expires_at: isoDate,
      used_at: nullableDate,
      revoked_at: nullableDate,
      created_at: isoDate,
    })
    .strict() satisfies z.ZodType<InvitationView>,
);

export const invitationListSchema = component(
  "InvitationList",
  z
    .object({
      invitations: z.array(invitationSchema),
      total: z.number().int(),
      limit: z.number().int(),
      offset: z.number().int(),
    })
    .strict(),
);

export const invitationCreatedSchema = component(
  "InvitationCreated",
  z.object({ invitation: invitationSchema, token: z.string() }).strict(),
);

export const redeemResultSchema = component(
  "RedeemResult",
  z
    .object({
      user: z.object({ id: z.uuid(), email: z.email(), display_name: z.string() }).strict(),
      invitation_id: z.uuid(),
    })
    .strict() satisfies z.ZodType<RedeemResult>,
);

export const apiKeySchema = component(
  "ApiKey",
  z
    .object({
      id: z.uuid(),
      kind: z.enum(["service", "delegated"]),
      name: z.string(),
      scopes: z.array(z.string()),
      user_id: z.uuid().nullable(),
      role_cap: z.enum(["admin", "super_admin"]).nullable(),
      prefix: z.string(),
      expires_at: nullableDate,
      revoked_at: nullableDate,
      last_used_at: nullableDate,
      created_at: isoDate,
    })
    .strict() satisfies z.ZodType<ApiKeyView>,
);

export const apiKeyListSchema = component(
  "ApiKeyList",
  z
    .object({
      api_keys: z.array(apiKeySchema),
      total: z.number().int(),
      limit: z.number().int(),
      offset: z.number().int(),
    })
    .strict(),
);

export const apiKeyResponseSchema = component(
  "ApiKeyResponse",
  z.object({ api_key: apiKeySchema }).strict(),
);

export const apiKeyCreatedSchema = component(
  "ApiKeyCreated",
  z.object({ api_key: apiKeySchema, secret: z.string() }).strict(),
);

export const deviceSchema = component(
  "Device",
  z
    .object({
      id: z.uuid(),
      user_id: z.uuid(),
      platform: z.enum(["android", "ios"]),
      push_token: z.string().nullable(),
      last_seen_at: isoDate,
      revoked_at: nullableDate,
      created_at: isoDate,
    })
    .strict() satisfies z.ZodType<DeviceView>,
);

export const deviceListSchema = component(
  "DeviceList",
  z.object({ devices: z.array(deviceSchema) }).strict(),
);

export const deviceResponseSchema = component(
  "DeviceResponse",
  z.object({ device: deviceSchema }).strict(),
);

export const moduleSettingSchema = component(
  "ModuleSetting",
  z
    .object({
      category_key: z.string(),
      key: z.string(),
      label: z.string(),
      help: z.string().nullable(),
      value: z.json().nullable(),
      is_secret: z.boolean(),
      configured: z.boolean(),
      is_public: z.boolean(),
      mcp_access: z.enum(["none", "read", "write"]),
      sort_order: z.number().int(),
      updated_at: isoDate,
    })
    .strict() satisfies z.ZodType<ModuleSettingView>,
);

export const moduleSchema = component(
  "Module",
  z
    .object({
      key: z.string(),
      name: z.string(),
      version: z.string(),
      state: z.enum(["installed", "active", "disabled"]),
      is_public: z.boolean(),
      mcp_exposed: z.enum(["none", "read", "read_write"]),
      installed_at: isoDate,
      updated_at: isoDate,
    })
    .strict() satisfies z.ZodType<ModuleView>,
);

export const moduleDetailSchema = component(
  "ModuleDetail",
  moduleSchema
    .extend({ settings_public: z.array(moduleSettingSchema) })
    .strict() satisfies z.ZodType<ModuleDetail>,
);

export const moduleListSchema = component(
  "ModuleList",
  z
    .object({
      modules: z.array(moduleSchema),
      total: z.number().int(),
      limit: z.number().int(),
      offset: z.number().int(),
    })
    .strict(),
);

export const moduleResponseSchema = component(
  "ModuleResponse",
  z.object({ module: moduleSchema }).strict(),
);

export const moduleDetailResponseSchema = component(
  "ModuleDetailResponse",
  z.object({ module: moduleDetailSchema }).strict(),
);

export const moduleSettingListSchema = component(
  "ModuleSettingList",
  z.object({ settings: z.array(moduleSettingSchema) }).strict(),
);

export const moduleSettingResponseSchema = component(
  "ModuleSettingResponse",
  z.object({ setting: moduleSettingSchema }).strict(),
);

export const settingSchema = component(
  "Setting",
  z
    .object({
      key: z.string(),
      category: z.string(),
      label: z.string(),
      help: z.string(),
      isSecret: z.boolean(),
      isPublic: z.boolean(),
      mcpAccess: z.enum(["none", "read", "write"]),
      sortOrder: z.number().int(),
      updatedBy: z.uuid().nullable(),
      updatedAt: isoDate,
      value: z.json().optional(),
      configured: z.boolean().optional(),
    })
    .strict() satisfies z.ZodType<SettingView>,
);

export const settingListSchema = component(
  "SettingList",
  z.object({ settings: z.array(settingSchema) }).strict(),
);

export const settingResponseSchema = component(
  "SettingResponse",
  z.object({ setting: settingSchema }).strict(),
);

const settingCategorySchema = z
  .object({
    categoryKey: z.string(),
    label: z.string(),
    help: z.string(),
    icon: z.string(),
    sortOrder: z.number().int(),
    settings: z.array(settingSchema),
  })
  .strict();
// The catalog type has no `settings` field: the route composes both.
export const settingsCategoriesSchema = component(
  "SettingsCategories",
  z
    .object({ categories: z.array(settingCategorySchema) })
    .strict() satisfies z.ZodType<{ categories: Array<SettingCategoryMeta & { settings: SettingView[] }> }>,
);

export const currencySchema = component(
  "Currency",
  z
    .object({ code: z.string(), enabled: z.boolean(), isDefault: z.boolean() })
    .strict() satisfies z.ZodType<CurrencyView>,
);

export const currencyListSchema = component(
  "CurrencyList",
  z
    .object({ default: z.string().nullable(), currencies: z.array(currencySchema) })
    .strict(),
);

export const currencyResponseSchema = component(
  "CurrencyResponse",
  z.object({ currency: currencySchema }).strict(),
);

export const translationsSchema = component(
  "Translations",
  z
    .object({ locale: z.string(), translations: z.record(z.string(), z.string()) })
    .strict(),
);

export const maintenanceResultSchema = component(
  "MaintenanceResult",
  z
    .object({
      job: z.string(),
      status: z.enum(["ok", "failed", "skipped", "timeout"]),
      summary: z.json().optional(),
    })
    .strict() satisfies z.ZodType<MaintenanceResult>,
);

export const maintenanceRunSchema = component(
  "MaintenanceRun",
  z.object({ runs: z.array(maintenanceResultSchema) }).strict(),
);

export const maintenanceStatusSchema = component(
  "MaintenanceStatus",
  z.object({ runs: z.array(z.json()), outbox: z.array(z.json()) }).strict(),
);

export const environmentSchema = component(
  "Environment",
  z
    .object({
      ready: z.boolean(),
      checks: z.array(
        z
          .object({
            key: z.enum(["database", "migrations", "encryption_key", "sentry"]),
            status: z.enum(["ok", "missing", "failed"]),
            hint: z.string(),
          })
          .strict(),
      ),
    })
    .strict() satisfies z.ZodType<EnvironmentReport>,
);

export const environmentResponseSchema = component(
  "EnvironmentResponse",
  z.object({ environment: environmentSchema }).strict(),
);

export const setupSuperAdminResponseSchema = component(
  "SetupSuperAdminResponse",
  z
    .object({
      user: z.object({ id: z.uuid(), email: z.email() }).strict(),
      jwt_expiry: z.number().nullable(),
      jwt_expiry_ok: z.boolean(),
    })
    .strict(),
);

export const setupTestEmailResponseSchema = component(
  "SetupTestEmailResponse",
  z.object({ sent: z.literal(true) }).strict(),
);

export const healthResponseSchema = component(
  "Health",
  z.union([
    z.object({ status: z.literal("ok") }).strict(),
    z
      .object({ status: z.literal("degraded"), degradedReasons: z.array(z.string()) })
      .strict(),
  ]),
);

export const instanceResponseSchema = component(
  "Instance",
  z
    .object({
      version: z.string(),
      requires_setup: z.boolean(),
      setup_incomplete: z.boolean(),
      settings_public: z.record(z.string(), z.json()),
    })
    .strict(),
);

export const openApiDocumentSchema = component(
  "OpenApiDocument",
  z
    .looseObject({
      openapi: z.string(),
      info: z.object({ title: z.string(), version: z.string() }).loose(),
      paths: z.record(z.string(), z.json()),
    })
    .describe("The generated OpenAPI 3.1 document served by this instance."),
);

export const errorResponseSchema = component(
  "ErrorResponse",
  z
    .object({
      error: z
        .object({
          code: z.enum(DOMAIN_ERROR_CODES),
          message: z.string(),
          request_id: z.uuid(),
          // `DomainError.details` is always an object (zod's `flatten()`), never
          // an array. The `satisfies` below keeps the schema tied to the type.
          details: z.record(z.string(), z.json()).optional(),
        })
        .loose(),
    })
    .strict() satisfies z.ZodType<ErrorEnvelope>,
);
