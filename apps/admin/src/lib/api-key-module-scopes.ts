import type { UserModule } from "@/lib/panel-user-modules";
import { allowedApiKeyScopes, type ApiKeyScopeKind, type ApiKeyScopeRoleCap } from "@/lib/api-key-scopes";

const READ = ":read";
const READ_WRITE = ":read_write";

/** Every offered module scope, in module order and `read` before `read_write`. */
export function moduleScopes(modules: readonly UserModule[]): string[] {
  return modules.flatMap((module) => [`${module.key}${READ}`, `${module.key}${READ_WRITE}`]);
}

/**
 * Scopes the key form may offer: the Core allowlist for `(kind, roleCap)` plus
 * the owner's module scopes. Modules only exist for delegated keys; a service
 * key never receives one.
 */
export function apiKeyOfferedScopes(
  kind: ApiKeyScopeKind,
  roleCap: ApiKeyScopeRoleCap | "",
  modules: readonly UserModule[] = [],
): string[] {
  const core = allowedApiKeyScopes(kind, roleCap);
  if (kind !== "delegated") return [...core];
  return [...core, ...moduleScopes(modules)];
}

function add(selected: readonly string[], scope: string): readonly string[] {
  return selected.includes(scope) ? selected : [...selected, scope];
}

function remove(selected: readonly string[], ...scopes: readonly string[]): readonly string[] {
  const found = scopes.some((scope) => selected.includes(scope));
  return found ? selected.filter((entry) => !scopes.includes(entry)) : selected;
}

function toggleReadWrite(
  selected: readonly string[],
  scope: string,
  checked: boolean,
): readonly string[] {
  if (!checked) return remove(selected, scope);
  const read = `${scope.slice(0, -READ_WRITE.length)}${READ}`;
  return add(add(selected, read), scope);
}

function toggleRead(
  selected: readonly string[],
  scope: string,
  checked: boolean,
): readonly string[] {
  if (checked) return add(selected, scope);
  const readWrite = `${scope.slice(0, -READ.length)}${READ_WRITE}`;
  return remove(selected, scope, readWrite);
}

function togglePlain(
  selected: readonly string[],
  scope: string,
  checked: boolean,
): readonly string[] {
  return checked ? add(selected, scope) : remove(selected, scope);
}

/**
 * Applies the two permission levels of a module scope: "read and write"
 * implies "read", and deselecting "read" also deselects "read and write".
 * Core scopes never carry `:read_write`, so they only toggle themselves.
 *
 * The result is the same array instance when nothing changed, so reducers can
 * keep referential equality.
 */
export function withModuleImplication(
  selected: readonly string[],
  scope: string,
  checked: boolean,
): readonly string[] {
  if (scope.endsWith(READ_WRITE)) return toggleReadWrite(selected, scope, checked);
  if (scope.endsWith(READ)) return toggleRead(selected, scope, checked);
  return togglePlain(selected, scope, checked);
}
