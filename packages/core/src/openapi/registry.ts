import type { ZodType } from "zod";
import { createApiKeySchema } from "../api-keys/api";
import { patchCurrencyBodySchema } from "../currencies/api";
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
import {
  userCategoryCreateSchema,
  userCategoryRenameSchema,
} from "../user-categories/api";
import { userPatchSchema } from "../users/api";
import {
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
  deviceListSchema,
  deviceResponseSchema,
  environmentResponseSchema,
  healthResponseSchema,
  instanceResponseSchema,
  invitationCreatedSchema,
  invitationListSchema,
  maintenanceRunSchema as maintenanceRunResponseSchema,
  maintenanceStatusSchema,
  moduleDetailResponseSchema,
  moduleListSchema,
  moduleResponseSchema,
  moduleSettingListSchema,
  moduleSettingResponseSchema,
  openApiDocumentSchema,
  overrideComponent,
  redeemResultSchema,
  settingListSchema,
  settingResponseSchema,
  settingsCategoriesSchema,
  setupSuperAdminResponseSchema,
  setupTestEmailResponseSchema,
  translationsSchema,
  userListSchema,
  userResponseSchema,
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
const deviceRegister = component("DeviceRegister", registerDeviceSchema);
const moduleUpdate = component("ModuleUpdate", moduleUpdateSchema);
const moduleUninstall = component("ModuleUninstall", moduleUninstallSchema);
const moduleSettingWrite = component("ModuleSettingWrite", moduleSettingSchema);
const settingsPatch = component("SettingsPatch", patchSettingBodySchema);
const settingsBatchPatch = component("SettingsBatchPatch", patchSettingsBodySchema);
const currencyPatch = component("CurrencyPatch", patchCurrencyBodySchema);
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
    path: "/users",
    summary: "List users (admins) with q/limit/offset.",
    scopes: ["users:read"],
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
    summary: "List invitations.",
    scopes: ["invitations:read"],
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
    method: "delete",
    path: "/invitations/{id}",
    summary: "Revoke a pending invitation.",
    scopes: ["invitations:write"],
    auth: "session",
    status: 204,
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
    summary: "List own keys, or all keys as super_admin.",
    scopes: ["api_keys:read"],
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
    summary: "Instance module catalogue.",
    scopes: ["modules:read"],
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
];
