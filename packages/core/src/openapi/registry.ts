import { z, type ZodType } from "zod";
import { createApiKeySchema, updateApiKeySchema } from "../api-keys/api";
import { patchCurrenciesBodySchema, patchCurrencyBodySchema } from "../currencies/api";
import { registerDeviceSchema } from "../devices/api";
import { createInvitationSchema, redeemInvitationSchema } from "../invitations/api";
import { maintenanceRunSchema } from "../maintenance/api";
import {
  moduleSettingSchema,
  moduleUninstallSchema,
  moduleUpdateSchema,
} from "../modules/api";
import { patchSettingBodySchema, patchSettingsBodySchema } from "../settings/api";
import { setupSuperAdminSchema } from "../setup/api";
import { mePatchSchema } from "../users/api";
import {
  userCategoryCreateSchema,
  userCategoryRenameSchema,
} from "../user-categories/api";
import { userPatchSchema } from "../users/api";
import {
  androidReleaseSchema,
  apiKeyCreatedSchema,
  apiKeyListSchema,
  apiKeyResponseSchema,
  categoryDetailResponseSchema,
  categoryListSchema,
  categoryModulesResponseSchema,
  categoryResponseSchema,
  component,
  currencyListSchema,
  currencyResponseSchema,
  dashboardWidgetListSchema,
  demoResponseSchema,
  deviceListSchema,
  deviceResponseSchema,
  environmentResponseSchema,
  healthResponseSchema,
  instanceResponseSchema,
  invitationCreatedSchema,
  invitationLinkResponseSchema,
  invitationResendResponseSchema,
  invitationDetailResponseSchema,
  invitationListSchema,
  invitationsQuerySchema,
  maintenanceRunSchema as maintenanceRunResponseSchema,
  maintenanceStatusSchema,
  moduleDetailResponseSchema,
  moduleGrantsSchema,
  moduleJobDispatchSchema,
  moduleJobRunListSchema,
  moduleJobRunResponseSchema,
  moduleListSchema,
  moduleResponseSchema,
  moduleSettingListSchema,
  moduleSettingResponseSchema,
  modulesQuerySchema,
  openApiDocumentSchema,
  overrideComponent,
  paginationQuerySchema,
  redeemResultSchema,
  settingListSchema,
  settingResponseSchema,
  settingsCategoriesSchema,
  setupSuperAdminResponseSchema,
  setupTestEmailResponseSchema,
  translationsSchema,
  userListSchema,
  userModulesResponseSchema,
  userResponseSchema,
  usersQuerySchema,
  apiKeysQuerySchema,
} from "./schemas";

/**
 * Metadata layer that ties the imperative `/api/v1` route handlers to the
 * shared zod schemas: this is not OpenAPI written by hand, and CI checks that
 * every route file has an operation here (and vice versa).
 */
export type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

/**
 * Who may call the operation, as published in the document:
 * - `public`: no credential.
 * - `session`: a Supabase session JWT or a `027_svc_`/`027_usr_` API key.
 * - `session-only`: a Supabase session JWT (never an API key).
 * - `service-key`: any API key (used by the instance-only maintenance door).
 * - `key`: only API keys. Reserved; no route needs it today.
 */
export type OperationAuth = "public" | "session" | "session-only" | "key" | "service-key";

/** Extra response documented outside the success status and the error default. */
export interface OperationResponse {
  description: string;
  /** Omitted for responses with no JSON body (e.g. 304). */
  schema?: ZodType;
}

export interface OpenApiOperation {
  method: HttpMethod;
  /** Path relative to `/api/v1`, with `{param}` placeholders. */
  path: string;
  summary: string;
  scopes: readonly string[];
  request?: ZodType;
  /** Query parameters (an object schema; every key is `in: query`). */
  query?: ZodType;
  /** Omitted for responses with no body (204). */
  response?: ZodType;
  auth: OperationAuth;
  /** Successful status; 200 unless the handler returns 201 or 204. */
  status?: 200 | 201 | 204;
  /** Additional status codes (health 503, translations 304, ...). */
  responses?: Record<string, OperationResponse>;
  /** Set `false` to omit the `default` error envelope (non-error operations). */
  errorDefault?: boolean;
}

const userPatch = component("UserPatch", userPatchSchema);
// `userPatchSchema` refines "at least one field"; JSON Schema emits the object
// shape but not the refinement, so publish the equivalent `minProperties`.
overrideComponent("UserPatch", { minProperties: 1 });
const categoryCreate = component("UserCategoryCreate", userCategoryCreateSchema);
const categoryRename = component("UserCategoryRename", userCategoryRenameSchema);
const invitationCreate = component("InvitationCreate", createInvitationSchema);
const invitationRedeem = component("InvitationRedeem", redeemInvitationSchema);
const apiKeyCreate = component("ApiKeyCreate", createApiKeySchema);
const apiKeyUpdate = component("ApiKeyUpdate", updateApiKeySchema);
// `updateApiKeySchema` refines "at least one field"; publish the equivalent
// `minProperties` because JSON Schema does not carry the refinement.
overrideComponent("ApiKeyUpdate", { minProperties: 1 });
const deviceRegister = component("DeviceRegister", registerDeviceSchema);
const moduleUpdate = component("ModuleUpdate", moduleUpdateSchema);
const moduleUninstall = component("ModuleUninstall", moduleUninstallSchema);
const moduleSettingWrite = component("ModuleSettingWrite", moduleSettingSchema);
const settingsPatch = component("SettingsPatch", patchSettingBodySchema);
const settingsBatchPatch = component("SettingsBatchPatch", patchSettingsBodySchema);
const currencyPatch = component("CurrencyPatch", patchCurrencyBodySchema);
const currenciesPatch = component("CurrenciesPatch", patchCurrenciesBodySchema);
const maintenanceRun = component("MaintenanceRunInput", maintenanceRunSchema);
const setupSuperAdmin = component("SetupSuperAdmin", setupSuperAdminSchema);

export const OPERATIONS: readonly OpenApiOperation[] = [
  {
    method: "get",
    path: "/health",
    summary: "Instance health (200 ok, 503 degraded).",
    scopes: [],
    response: healthResponseSchema,
    auth: "public",
    // 503 still carries the Health body, not the error envelope; there is no
    // `default` because every status this operation returns is documented.
    responses: {
      "503": {
        description: "Degraded: at least one dependency is not healthy.",
        schema: healthResponseSchema,
      },
    },
    errorDefault: false,
  },
  {
    method: "get",
    path: "/app/android",
    summary: "Latest Android build the app can update to (public).",
    scopes: [],
    response: androidReleaseSchema,
    auth: "public",
  },
  {
    method: "get",
    path: "/instance",
    summary: "Non-sensitive instance metadata and public settings.",
    scopes: [],
    response: instanceResponseSchema,
    auth: "public",
  },
  {
    method: "get",
    path: "/openapi.json",
    summary: "This OpenAPI 3.1 document.",
    scopes: [],
    response: openApiDocumentSchema,
    auth: "public",
  },
  {
    method: "get",
    path: "/setup/environment",
    summary: "Setup wizard step 1: environment checks (closed once installed).",
    scopes: [],
    response: environmentResponseSchema,
    auth: "public",
  },
  {
    method: "post",
    path: "/setup/super-admin",
    summary: "Create the first super_admin (public only while none exists).",
    scopes: [],
    request: setupSuperAdmin,
    response: setupSuperAdminResponseSchema,
    auth: "public",
    status: 201,
  },
  {
    method: "post",
    path: "/setup/test-email",
    summary: "Send an SMTP test to the authenticated super_admin.",
    scopes: ["users:write"],
    response: setupTestEmailResponseSchema,
    auth: "session-only",
  },
  {
    method: "get",
    path: "/me",
    summary: "The caller's own profile (session or delegated key).",
    scopes: ["profile:read"],
    response: userResponseSchema,
    auth: "session",
  },
  {
    method: "patch",
    path: "/me",
    summary: "Edit the caller's display name, locale and theme; never the role.",
    scopes: ["profile:write"],
    request: mePatchSchema,
    response: userResponseSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/me/modules",
    summary: "Modules the caller can open: public plus granted, or every active one for admins.",
    scopes: ["profile:read"],
    query: modulesQuerySchema,
    response: moduleListSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/users",
    summary: "List users (admins) with q/role/state; state defaults to active, all removes it.",
    scopes: ["users:read"],
    query: usersQuerySchema,
    response: userListSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/users/{id}",
    summary: "User detail.",
    scopes: ["users:read"],
    response: userResponseSchema,
    auth: "session",
  },
  {
    method: "patch",
    path: "/users/{id}",
    summary: "Edit profile fields; role changes additionally require roles:assign.",
    scopes: ["users:write"],
    request: userPatch,
    response: userResponseSchema,
    auth: "session",
  },
  {
    method: "delete",
    path: "/users/{id}",
    summary: "Soft-deactivate a user (super_admin, root protected).",
    scopes: ["users:deactivate"],
    response: userResponseSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/users/{id}/restore",
    summary: "Reactivate a soft-deactivated user (super_admin, idempotent).",
    scopes: ["users:deactivate"],
    response: userResponseSchema,
    auth: "session",
  },
  {
    method: "delete",
    path: "/users/{id}/purge",
    summary:
      "Permanently delete a deactivated user (super_admin, irreversible; root protected).",
    scopes: ["users:deactivate"],
    auth: "session",
    status: 204,
  },
  {
    method: "get",
    path: "/users/{id}/modules",
    summary: "Modules currently granted to a user (live grants on installed/active modules).",
    scopes: ["users:read"],
    response: userModulesResponseSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/users/{id}/modules/{key}",
    summary: "Grant module access to a user.",
    scopes: ["modules:grant"],
    auth: "session",
    status: 204,
  },
  {
    method: "delete",
    path: "/users/{id}/modules/{key}",
    summary: "Revoke module access from a user (soft).",
    scopes: ["modules:grant"],
    auth: "session",
    status: 204,
  },
  {
    method: "get",
    path: "/user-categories",
    summary: "List user categories.",
    scopes: ["user_categories:read"],
    query: paginationQuerySchema,
    response: categoryListSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/user-categories",
    summary: "Create a user category.",
    scopes: ["user_categories:write"],
    request: categoryCreate,
    response: categoryResponseSchema,
    auth: "session",
    status: 201,
  },
  {
    method: "get",
    path: "/user-categories/{id}",
    summary: "Category detail with its members.",
    scopes: ["user_categories:read"],
    response: categoryDetailResponseSchema,
    auth: "session",
  },
  {
    method: "patch",
    path: "/user-categories/{id}",
    summary: "Rename a category.",
    scopes: ["user_categories:write"],
    request: categoryRename,
    response: categoryDetailResponseSchema,
    auth: "session",
  },
  {
    method: "delete",
    path: "/user-categories/{id}",
    summary: "Delete a category (materialised grants are kept).",
    scopes: ["user_categories:write"],
    auth: "session",
    status: 204,
  },
  {
    method: "post",
    path: "/user-categories/{id}/members/{userId}",
    summary: "Add a member to a category.",
    scopes: ["user_categories:write"],
    auth: "session",
    status: 204,
  },
  {
    method: "delete",
    path: "/user-categories/{id}/members/{userId}",
    summary: "Remove a member from a category.",
    scopes: ["user_categories:write"],
    auth: "session",
    status: 204,
  },
  {
    method: "get",
    path: "/user-categories/{id}/modules",
    summary: "Modules assigned to a category.",
    scopes: ["user_categories:read", "modules:read"],
    response: categoryModulesResponseSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/user-categories/{id}/modules/{key}",
    summary: "Assign a module to a category (materialises access for members).",
    scopes: ["user_categories:write", "modules:grant"],
    response: categoryModulesResponseSchema,
    auth: "session",
  },
  {
    method: "delete",
    path: "/user-categories/{id}/modules/{key}",
    summary: "Remove a module from a category (does not revoke access).",
    scopes: ["user_categories:write", "modules:grant"],
    response: categoryModulesResponseSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/invitations",
    summary: "List invitations, optionally by derived status.",
    scopes: ["invitations:read"],
    query: invitationsQuerySchema,
    response: invitationListSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/invitations",
    summary: "Create a single-use invitation; the token is returned once.",
    scopes: ["invitations:write"],
    request: invitationCreate,
    response: invitationCreatedSchema,
    auth: "session",
    status: 201,
  },
  {
    method: "get",
    path: "/invitations/{id}",
    summary: "Invitation detail with its creator; the token is never returned.",
    scopes: ["invitations:read"],
    response: invitationDetailResponseSchema,
    auth: "session",
  },
  {
    method: "delete",
    path: "/invitations/{id}",
    summary: "Revoke a pending invitation.",
    scopes: ["invitations:write"],
    auth: "session",
    status: 204,
  },
  {
    method: "post",
    path: "/invitations/{id}/resend-email",
    summary: "Reissue the token and send the invitation again (pending only).",
    scopes: ["invitations:write"],
    response: invitationResendResponseSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/invitations/{id}/link",
    summary: "Reissue the token without sending it, for manual delivery.",
    scopes: ["invitations:write"],
    response: invitationLinkResponseSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/invitations/{id}/redeem",
    summary: "Redeem an invitation with its single-use token (public).",
    scopes: [],
    request: invitationRedeem,
    response: redeemResultSchema,
    auth: "public",
    status: 201,
  },
  {
    method: "get",
    path: "/api-keys",
    summary: "List own keys, or all keys as super_admin; filter by kind, owner and state.",
    scopes: ["api_keys:read"],
    query: apiKeysQuerySchema,
    response: apiKeyListSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/api-keys",
    summary: "Create a service or delegated key; the secret is returned once.",
    scopes: ["api_keys:write"],
    request: apiKeyCreate,
    response: apiKeyCreatedSchema,
    auth: "session",
    status: 201,
  },
  {
    method: "get",
    path: "/api-keys/{id}",
    summary: "Key detail (never the secret).",
    scopes: ["api_keys:read"],
    response: apiKeyResponseSchema,
    auth: "session",
  },
  {
    method: "delete",
    path: "/api-keys/{id}",
    summary: "Revoke a key immediately.",
    scopes: ["api_keys:revoke"],
    auth: "session",
    status: 204,
  },
  {
    method: "patch",
    path: "/api-keys/{id}",
    summary: "Rename, re-scope or extend a key; kind, role cap and owner are immutable.",
    scopes: ["api_keys:write"],
    request: apiKeyUpdate,
    response: apiKeyResponseSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/devices",
    summary: "Own devices; admins may filter with ?user=.",
    scopes: ["devices:read"],
    response: deviceListSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/devices",
    summary: "Register or refresh this device (idempotent by push_token).",
    scopes: ["devices:write"],
    request: deviceRegister,
    response: deviceResponseSchema,
    auth: "session",
  },
  {
    method: "delete",
    path: "/devices/{id}",
    summary: "Revoke a device (soft) and drop its sessions.",
    scopes: ["devices:revoke"],
    auth: "session",
    status: 204,
  },
  {
    method: "get",
    path: "/modules",
    summary: "Instance module catalogue, filterable by state and visibility.",
    scopes: ["modules:read"],
    query: modulesQuerySchema,
    response: moduleListSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/modules/{key}",
    summary: "Module detail with its public settings.",
    scopes: ["modules:read"],
    response: moduleDetailResponseSchema,
    auth: "session",
  },
  {
    method: "patch",
    path: "/modules/{key}",
    summary: "Change is_public and mcp_exposed.",
    scopes: ["modules:manage"],
    request: moduleUpdate,
    response: moduleResponseSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/modules/{key}/install",
    summary: "Install the trusted packaged manifest.",
    scopes: ["modules:manage"],
    response: moduleResponseSchema,
    auth: "session",
    status: 201,
  },
  {
    method: "post",
    path: "/modules/{key}/activate",
    summary: "Activate an installed module.",
    scopes: ["modules:manage"],
    response: moduleResponseSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/modules/{key}/deactivate",
    summary: "Deactivate a module without reversing its DDL.",
    scopes: ["modules:manage"],
    response: moduleResponseSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/modules/{key}/uninstall",
    summary: "Reverse migrations and remove the module (super_admin).",
    scopes: ["modules:manage"],
    request: moduleUninstall,
    auth: "session",
    status: 204,
  },
  {
    method: "post",
    path: "/modules/{key}/upgrade",
    summary: "Apply the newer trusted package, keeping data and settings.",
    scopes: ["modules:manage"],
    response: moduleResponseSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/modules/{key}/jobs",
    summary: "Last runs of the module's scheduled jobs.",
    scopes: ["modules:read"],
    response: moduleJobRunListSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/modules/{key}/jobs/{job}/run",
    summary: "Run one scheduled job now (admins).",
    scopes: ["modules:manage"],
    response: moduleJobRunResponseSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/modules/{key}/grants",
    summary: "Users and categories with access to the module (admins, aggregated once).",
    scopes: ["modules:manage"],
    response: moduleGrantsSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/modules/{key}/settings",
    summary: "All module settings (admins; secrets masked).",
    scopes: ["modules:read", "settings:read"],
    response: moduleSettingListSchema,
    auth: "session",
  },
  {
    method: "patch",
    path: "/modules/{key}/settings",
    summary: "Write one module setting.",
    scopes: ["modules:manage", "settings:write"],
    request: moduleSettingWrite,
    response: moduleSettingResponseSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/demo",
    summary: "Demo dataset status: enabled, seeded and what each module seeded.",
    scopes: ["settings:read"],
    response: demoResponseSchema,
    auth: "session",
  },
  {
    method: "post",
    path: "/demo",
    summary: "Seed the demo dataset (admins; refused in production).",
    scopes: ["settings:write"],
    response: demoResponseSchema,
    auth: "session",
  },
  {
    method: "delete",
    path: "/demo",
    summary: "Clear the demo dataset; refuses while a module still holds it.",
    scopes: ["settings:write"],
    response: demoResponseSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/me/dashboard",
    summary: "Dashboard widgets of the active modules the caller can use.",
    scopes: ["profile:read"],
    query: z.object({ surface: z.enum(["app", "panel"]).optional() }),
    response: dashboardWidgetListSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/settings",
    summary: "All settings; secrets are masked as configured.",
    scopes: ["settings:read"],
    response: settingListSchema,
    auth: "session",
  },
  {
    method: "patch",
    path: "/settings",
    summary: "Write up to 30 settings in one transaction.",
    scopes: ["settings:write"],
    request: settingsBatchPatch,
    response: settingListSchema,
    auth: "session",
  },
  {
    method: "patch",
    path: "/settings/{category}/{key}",
    summary: "Write one setting value.",
    scopes: ["settings:write"],
    request: settingsPatch,
    response: settingResponseSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/settings-categories",
    summary: "Settings grouped by category and sort order.",
    scopes: ["settings:read"],
    response: settingsCategoriesSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/currencies",
    summary: "Currencies with their enabled flag and the default.",
    scopes: ["currencies:read"],
    response: currencyListSchema,
    auth: "session",
  },
  {
    method: "patch",
    path: "/currencies",
    summary: "Enable or disable up to 200 currencies in one transaction.",
    scopes: ["currencies:write"],
    request: currenciesPatch,
    response: currencyListSchema,
    auth: "session",
  },
  {
    method: "patch",
    path: "/currencies/{code}",
    summary: "Enable or disable a currency; the default cannot be disabled.",
    scopes: ["currencies:write"],
    request: currencyPatch,
    response: currencyResponseSchema,
    auth: "session",
  },
  {
    method: "get",
    path: "/translations",
    summary: "Resolved translation pairs for an enabled locale (ETag).",
    scopes: ["profile:read"],
    response: translationsSchema,
    auth: "session",
    // `If-None-Match` with the current ETag answers 304 with no body.
    responses: {
      "304": { description: "Not modified: the ETag matches the current payload." },
    },
  },
  {
    method: "post",
    path: "/maintenance/run",
    summary: "Run allowlisted maintenance jobs (instance service key).",
    scopes: ["maintenance:run"],
    request: maintenanceRun,
    response: maintenanceRunResponseSchema,
    auth: "service-key",
  },
  {
    method: "get",
    path: "/maintenance/status",
    summary: "Last run per job, outbox counters and health (super_admin).",
    scopes: [],
    response: maintenanceStatusSchema,
    auth: "session-only",
  },
  {
    method: "get",
    path: "/maintenance/module-jobs",
    summary: "Run the module jobs that are due now (platform cron, cron secret).",
    scopes: [],
    response: moduleJobDispatchSchema,
    auth: "service-key",
    responses: {
      "401": { description: "The bearer token does not match the cron secret." },
      "503": { description: "Neither CRON_SECRET nor MAINTENANCE_CRON_SECRET is configured." },
    },
  },
];
