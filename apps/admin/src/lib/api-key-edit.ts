import type { MutationFailure } from "@/lib/mutation-result";
import type { ApiKeyUpdate } from "@/lib/panel-keys";

/** Server-action state for the edit form: only the failure survives a submit. */
export interface ApiKeyEditState {
  error: MutationFailure | null;
}

export const INITIAL_API_KEY_EDIT_STATE: ApiKeyEditState = { error: null };

/**
 * Splits the stored scopes into the ones the panel offers (`editable`) and the
 * ones it cannot represent (`preserved`, i.e. module permissions granted by a
 * module). The form never owns the preserved set: it must travel untouched.
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
 * Keeps the selected scopes inside the allowlist of the key. A legacy key can
 * carry scopes the policy no longer grants: they never enter the editable set.
 */
export function toggleKeyScope(
  selected: readonly string[],
  scope: string,
  checked: boolean,
  allowed: readonly string[],
): readonly string[] {
  if (!checked) return selected.filter((entry) => entry !== scope);
  if (!allowed.includes(scope)) return selected;
  if (selected.includes(scope)) return selected;
  return [...selected, scope];
}

/** Bulk selection is exactly the allowlist: never a scope the key cannot use. */
export function selectAllKeyScopes(allowed: readonly string[]): readonly string[] {
  return [...allowed];
}

/** `YYYY-MM-DDTHH:mm` for a `datetime-local` input, in the browser's zone. */
export function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * `undefined` keeps the stored expiry, `null` means the value is unusable.
 * The API cannot clear an expiry, so an unchanged or empty field never travels.
 */
function changedExpiry(expiresAt: string, currentExpiresAt: string): string | null | undefined {
  const value = expiresAt.trim();
  if (!value || value === currentExpiresAt.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Patch the Core accepts. `name` and `scopes` always travel with the exact set
 * the caller already merged (editable allowlist + preserved module scopes);
 * `expires_at` only travels when it actually changed.
 */
export function buildApiKeyUpdateInput(fields: {
  name: string;
  scopes: readonly string[];
  expiresAt?: string;
  currentExpiresAt?: string;
}): ApiKeyUpdate | null {
  const name = fields.name.trim();
  if (name.length < 1 || name.length > 80) return null;

  const scopes = [...fields.scopes];
  if (scopes.length === 0) return null;

  const expiresAt = changedExpiry(fields.expiresAt ?? "", fields.currentExpiresAt ?? "");
  if (expiresAt === null) return null;

  return { name, scopes, ...(expiresAt ? { expires_at: expiresAt } : {}) };
}
