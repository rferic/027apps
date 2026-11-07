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

export const ALL_API_KEY_SCOPES: readonly string[] = API_KEY_SCOPE_GROUPS.flatMap(
  (group) => group.scopes,
);
