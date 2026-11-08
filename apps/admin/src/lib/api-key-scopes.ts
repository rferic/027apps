/**
 * Scope hints offered by the key form. It mirrors the action scopes the guard
 * grants sessions (`packages/core/src/auth/guard.ts`); the API remains the
 * source of truth and rejects anything outside its scope pattern.
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

const USER_SCOPES = [
  "profile:read",
  "profile:write",
  "currencies:read",
  "api_keys:read",
  "api_keys:write",
  "api_keys:revoke",
  "devices:read",
  "devices:write",
  "devices:revoke",
  "modules:read",
] as const;

const ADMIN_SCOPES = [
  ...USER_SCOPES,
  "users:read",
  "users:write",
  "roles:assign",
  "user_categories:read",
  "user_categories:write",
  "modules:manage",
  "modules:grant",
  "invitations:read",
  "invitations:write",
  "settings:read",
  "settings:write",
  "currencies:write",
] as const;

const SERVICE_SUPER_ADMIN_SCOPES = [...ADMIN_SCOPES, "users:deactivate", "maintenance:run"] as const;

/**
 * Scopes a key can actually use, mirroring the Core guard's role floor. A
 * delegated key inherits its owner's role, so the form caps it at admin: it
 * never offers `maintenance:run` (service-only) nor super-admin scopes. A
 * service key without a chosen cap offers only the scopes both caps share; the
 * super-admin-only ones appear once that cap is selected. The requested list
 * can still be wider than what the key ends up using, hence the "requested
 * scopes" label in the panel.
 */
export function allowedApiKeyScopes(
  kind: ApiKeyScopeKind,
  roleCap: ApiKeyScopeRoleCap | "",
): readonly string[] {
  if (kind === "service") {
    return roleCap === "super_admin" ? SERVICE_SUPER_ADMIN_SCOPES : ADMIN_SCOPES;
  }
  return ADMIN_SCOPES;
}

export const ALL_API_KEY_SCOPES: readonly string[] = API_KEY_SCOPE_GROUPS.flatMap(
  (group) => group.scopes,
);
