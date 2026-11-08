import { withModuleImplication } from "@/lib/api-key-module-scopes";
import type { MutationFailure } from "@/lib/mutation-result";
import type { ApiKeyUpdate } from "@/lib/panel-keys";

/** Server-action state for the edit form: only the failure survives a submit. */
export interface ApiKeyEditState {
  error: MutationFailure | null;
}

export const INITIAL_API_KEY_EDIT_STATE: ApiKeyEditState = { error: null };

/**
 * Stable identity of the stored values the edit form seeds from. Mounting the
 * form with this as its React `key` remounts it when the server data changes
 * (a scope removed, a rename), so `useState` is seeded again from the fresh
 * RSC. Without it the client keeps its previous selection even though the
 * page was re-rendered with new data.
 *
 * The scope order is normalised because the API does not promise one; the
 * parts are JSON-encoded so a scope or a name containing the separator cannot
 * make two different keys collide.
 */
export function apiKeyFingerprint(apiKey: {
  id: string;
  name: string;
  expiresAt: string | null;
  scopes: readonly string[];
}): string {
  return JSON.stringify([
    apiKey.id,
    apiKey.name,
    apiKey.expiresAt ?? "",
    [...apiKey.scopes].sort(),
  ]);
}

/**
 * Splits the stored scopes into the ones the form offers (`editable`) and the
 * ones it cannot represent (`preserved`): a module permission that is no longer
 * granted to the owner, or a legacy scope outside the Core allowlist. The form
 * never owns the preserved set: it must travel untouched.
 */
export function splitKeyScopes(
  scopes: readonly string[],
  allowed: readonly string[],
): { editable: string[]; preserved: string[] } {
  const editable: string[] = [];
  const preserved: string[] = [];
  for (const scope of scopes) {
    if (allowed.includes(scope)) editable.push(scope);
    else preserved.push(scope);
  }
  return { editable, preserved };
}

/**
 * Scopes the update sends: every preserved module scope plus the editable
 * selection limited to the key allowlist. Preserved scopes cannot be removed
 * from this form.
 */
export function mergeKeyScopes(
  preserved: readonly string[],
  selected: readonly string[],
  allowed: readonly string[],
): string[] {
  return [...preserved, ...selected.filter((scope) => allowed.includes(scope))];
}

/**
 * Keeps the selected scopes inside the offered set (Core allowlist plus the
 * owner's module scopes). A legacy key can carry scopes the policy no longer
 * grants: they never enter the editable set. Module scopes follow the
 * read-and-write/read implication.
 */
export function toggleKeyScope(
  selected: readonly string[],
  scope: string,
  checked: boolean,
  allowed: readonly string[],
): readonly string[] {
  if (checked && !allowed.includes(scope)) return selected;
  return withModuleImplication(selected, scope, checked);
}

/** Bulk selection is exactly the offered scopes: never a scope the key cannot use. */
export function selectAllKeyScopes(allowed: readonly string[]): readonly string[] {
  return [...allowed];
}

/**
 * Patch the Core accepts. `name` and `scopes` always travel with the exact set
 * the caller already merged (editable allowlist + preserved module scopes).
 * The expiry is not part of this builder: the form action resolves it from the
 * expiry field and merges it, so an untouched expiry never travels.
 */
export function buildApiKeyUpdateInput(fields: {
  name: string;
  scopes: readonly string[];
}): ApiKeyUpdate | null {
  const name = fields.name.trim();
  if (name.length < 1 || name.length > 80) return null;

  const scopes = [...fields.scopes];
  if (scopes.length === 0) return null;

  return { name, scopes };
}
