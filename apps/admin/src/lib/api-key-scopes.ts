import { MACHINE_SCOPES } from "@027apps/core/auth/guard.js";

/**
 * Scope hints offered by the key form. The policy lives in the Core guard; this
 * module only groups the resulting allowlist for the UI, never duplicates it.
 */
export type ScopeGroupId =
  | "profile"
  | "members"
  | "categories"
  | "invitations"
  | "modules"
  | "devices"
  | "api_keys"
  | "settings"
  | "currencies"
  | "maintenance";

export interface ScopeGroup {
  id: ScopeGroupId;
  scopes: readonly string[];
}

export const API_KEY_SCOPE_GROUPS: readonly ScopeGroup[] = [
  { id: "profile", scopes: ["profile:read", "profile:write"] },
  { id: "members", scopes: ["users:read", "users:write", "users:deactivate", "roles:assign"] },
  { id: "categories", scopes: ["user_categories:read", "user_categories:write"] },
  { id: "invitations", scopes: ["invitations:read", "invitations:write"] },
  { id: "modules", scopes: ["modules:read", "modules:manage", "modules:grant"] },
  { id: "devices", scopes: ["devices:read", "devices:write", "devices:revoke"] },
  { id: "api_keys", scopes: ["api_keys:read", "api_keys:write", "api_keys:revoke"] },
  { id: "settings", scopes: ["settings:read", "settings:write"] },
  { id: "currencies", scopes: ["currencies:read", "currencies:write"] },
  { id: "maintenance", scopes: ["maintenance:run"] },
];

export type ApiKeyScopeKind = "service" | "delegated";
export type ApiKeyScopeRoleCap = "admin" | "super_admin";

/**
 * Scopes a key can actually use. A delegated key is always a plain user, so it
 * gets the fixed delegated allowlist regardless of any cap. A service key is
 * bounded by its cap; before one is chosen, only the scopes both caps share are
 * offered.
 */
export function allowedApiKeyScopes(
  kind: ApiKeyScopeKind,
  roleCap: ApiKeyScopeRoleCap | "",
): readonly string[] {
  if (kind === "delegated") return MACHINE_SCOPES.delegated;
  return roleCap === "super_admin"
    ? MACHINE_SCOPES.service.super_admin
    : MACHINE_SCOPES.service.admin;
}

export const ALL_API_KEY_SCOPES: readonly string[] = API_KEY_SCOPE_GROUPS.flatMap(
  (group) => group.scopes,
);

/**
 * Readable label for a known core scope. Module scopes are dynamic
 * (`<module>:read|read_write`), so they stay as their identifier.
 */
export const API_KEY_SCOPE_LABELS: Readonly<Record<string, string>> = {
  "profile:read": "Read profile",
  "profile:write": "Update profile",
  "users:read": "Read members",
  "users:write": "Create members",
  "users:deactivate": "Deactivate members",
  "roles:assign": "Assign roles",
  "user_categories:read": "Read categories",
  "user_categories:write": "Assign categories",
  "invitations:read": "Read invitations",
  "invitations:write": "Invite members",
  "modules:read": "Read modules",
  "modules:manage": "Manage modules",
  "modules:grant": "Grant modules",
  "devices:read": "Read devices",
  "devices:write": "Manage devices",
  "devices:revoke": "Revoke devices",
  "api_keys:read": "Read API keys",
  "api_keys:write": "Create API keys",
  "api_keys:revoke": "Revoke API keys",
  "settings:read": "Read settings",
  "settings:write": "Change settings",
  "currencies:read": "Read currencies",
  "currencies:write": "Change currencies",
  "maintenance:run": "Run maintenance",
};

export function apiKeyScopeLabel(scope: string): string {
  return API_KEY_SCOPE_LABELS[scope] ?? scope;
}
