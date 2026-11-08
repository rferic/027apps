import { createHash, randomBytes } from "node:crypto";
import { DomainError } from "../errors";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";
import { DELEGATED_SCOPES, MACHINE_SCOPES, effectiveScopes, isModuleScope } from "../auth/guard";

/**
 * Machine tokens (tokens spec §3.2/§3.3/§6). A service key acts as the
 * instance with a role cap; a delegated key always acts as a plain user and
 * only carries the delegated allowlist. Only the SHA-256 of the token is
 * stored and the secret is returned exactly once at creation.
 */
export interface ApiKeysDeps {
  db: QueryClient;
  withTransaction?: <T>(fn: (db: QueryClient) => Promise<T>) => Promise<T>;
  now?: () => Date;
}

export type ApiKeyKind = "service" | "delegated";
export type ApiKeyRoleCap = "admin" | "super_admin";

export type ApiKeyView = {
  id: string;
  kind: ApiKeyKind;
  name: string;
  scopes: string[];
  user_id: string | null;
  role_cap: ApiKeyRoleCap | null;
  prefix: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

export type CreateApiKeyInput = {
  kind: ApiKeyKind;
  name: string;
  scopes: string[];
  role_cap?: ApiKeyRoleCap;
  /** Owner of a delegated key; only a super_admin session may set it. */
  user_id?: string;
  expires_at?: string;
};

/**
 * Editable fields of an existing key. `kind`, `role_cap` and `user_id` are
 * immutable: re-scoping is bounded by the stored cap and owner.
 */
export type UpdateApiKeyInput = {
  name?: string;
  scopes?: string[];
  expires_at?: string;
};

export type ApiKeyResolution = {
  id: string;
  kind: ApiKeyKind;
  scopes: string[];
  roleCap: ApiKeyRoleCap | null;
  userId: string | null;
};

/** One page of API keys plus the total across every page. */
export interface ApiKeyList {
  api_keys: ApiKeyView[];
  total: number;
}

/** `all` is the explicit opt-out of the kind filter. */
export type ApiKeyKindFilter = "all" | "service" | "delegated";

/**
 * Filters accepted by the list. `user` narrows the owner of delegated keys
 * and is only meaningful to a super_admin (anyone else only sees their own).
 */
export interface ApiKeyListFilters {
  kind?: ApiKeyKindFilter;
  user?: string;
}

export interface ApiKeyPage extends ApiKeyListFilters {
  limit: number;
  offset: number;
}

const SERVICE_PREFIX = "027_svc_";
const DELEGATED_PREFIX = "027_usr_";
const MAX_SCOPES = 100;
const MAX_ACTIVE_DELEGATED_KEYS = 5;
const SCOPE = /^[a-z0-9][a-z0-9_-]{0,63}:[a-z0-9_]{1,32}$/;

const toIso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? "");
const toIsoOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : toIso(value);

export function hashApiKeyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function apiKeyPrefix(kind: ApiKeyKind): string {
  return kind === "service" ? SERVICE_PREFIX : DELEGATED_PREFIX;
}

function newApiKeyToken(kind: ApiKeyKind): string {
  return `${apiKeyPrefix(kind)}${randomBytes(32).toString("base64url")}`;
}

function validateScopes(values: string[]): string[] {
  const unique = [...new Set(values)];
  if (unique.length < 1 || unique.length > MAX_SCOPES) {
    throw new DomainError("validation_failed", `scopes must contain 1..${MAX_SCOPES} entries`);
  }
  for (const scope of unique) {
    if (!SCOPE.test(scope)) throw new DomainError("validation_failed", "invalid scope");
  }
  return unique.sort();
}

function isSuperAdmin(caller: Caller): boolean {
  if (caller.kind === "session") return caller.role === "super_admin";
  if (caller.kind === "service") return caller.roleCap === "super_admin";
  // A delegated key is always a plain user, whatever its stored role cap.
  return false;
}

function keyLimitError(): DomainError {
  return new DomainError(
    "conflict",
    `A user can have at most ${MAX_ACTIVE_DELEGATED_KEYS} active delegated API keys`,
    { code: "key_limit" },
  );
}

function moduleKeyOf(scope: string): string {
  return scope.slice(0, scope.indexOf(":"));
}

async function assertActiveOwner(db: QueryClient, ownerId: string): Promise<void> {
  const { rows } = await db.query(
    "select role from public.profiles where id = $1 and deactivated_at is null",
    [ownerId],
  );
  if (!rows[0]) throw new DomainError("not_found");
}

/** Module scopes the owner actually holds, read live from `user_modules`. */
async function grantedModuleScopes(
  db: QueryClient,
  ownerId: string,
  requested: readonly string[],
): Promise<string[]> {
  const keys = [...new Set(requested.filter(isModuleScope).map(moduleKeyOf))];
  if (keys.length === 0) return [];
  const { rows } = await db.query(
    `select module_key from public.user_modules
      where user_id = $1 and module_key = any($2::text[]) and revoked_at is null`,
    [ownerId, keys],
  );
  const granted = new Set(rows.map((row) => String(row.module_key)));
  return requested.filter((scope) => isModuleScope(scope) && granted.has(moduleKeyOf(scope)));
}

/**
 * Scopes a delegated key may actually store: the fixed allowlist plus the
 * owner's live module grants, intersected with the creator's own effective
 * scopes. A session's module capability comes from `user_modules`, not from a
 * scope string, so granted module scopes are not trimmed for sessions.
 */
async function delegatedCreationScopes(
  db: QueryClient,
  caller: Caller,
  ownerId: string,
  requested: readonly string[],
): Promise<string[]> {
  const granted = await grantedModuleScopes(db, ownerId, requested);
  const allowed = new Set<string>([...DELEGATED_SCOPES, ...granted]);
  const own = new Set(effectiveScopes(caller));
  return requested.filter(
    (scope) => allowed.has(scope) && (own.has(scope) || isModuleScope(scope)),
  );
}

function assertServiceScopes(scopes: readonly string[], cap: ApiKeyRoleCap): void {
  const allowed: readonly string[] = MACHINE_SCOPES.service[cap];
  if (scopes.some((scope) => !allowed.includes(scope))) {
    throw new DomainError("validation_failed", "scope is not allowed for a service key");
  }
}

async function withTx<T>(
  deps: ApiKeysDeps,
  fn: (db: QueryClient) => Promise<T>,
): Promise<T> {
  if (!deps.withTransaction) return fn(deps.db);
  return deps.withTransaction(async (db) => {
    await db.query("BEGIN");
    try {
      const result = await fn(db);
      await db.query("COMMIT");
      return result;
    } catch (err) {
      await db.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  });
}

async function insertKey(
  db: QueryClient,
  row: {
    secret: string;
    kind: ApiKeyKind;
    name: string;
    scopes: string[];
    userId: string | null;
    roleCap: ApiKeyRoleCap | null;
    actor: string;
    expiresAt: string | null;
  },
): Promise<ApiKeyView> {
  const { rows } = await db.query(
    `insert into public.api_keys
       (key_hash, kind, name, scopes, user_id, role_cap, created_by, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning ${VIEW_COLUMNS}`,
    [
      hashApiKeyToken(row.secret),
      row.kind,
      row.name,
      row.scopes,
      row.userId,
      row.roleCap,
      row.actor,
      row.expiresAt,
    ],
  );
  return toView(rows[0]!);
}

/** The human the key is attributed to; service keys have no user. */
function actorUserId(caller: Caller): string {
  if (caller.kind === "session" || caller.kind === "delegated") return caller.userId;
  throw new DomainError("insufficient_scope");
}

function toView(row: Record<string, unknown>): ApiKeyView {
  const kind = String(row.kind) as ApiKeyKind;
  return {
    id: String(row.id),
    kind,
    name: String(row.name),
    scopes: (row.scopes as string[] | null) ?? [],
    user_id: row.user_id === null ? null : String(row.user_id),
    role_cap: row.role_cap === null ? null : (String(row.role_cap) as ApiKeyRoleCap),
    prefix: apiKeyPrefix(kind),
    expires_at: toIsoOrNull(row.expires_at),
    revoked_at: toIsoOrNull(row.revoked_at),
    last_used_at: toIsoOrNull(row.last_used_at),
    created_at: toIso(row.created_at),
  };
}

const VIEW_COLUMNS =
  "id, kind, name, scopes, user_id, role_cap, expires_at, revoked_at, last_used_at, created_at";

export async function createApiKey(
  deps: ApiKeysDeps,
  caller: Caller,
  input: CreateApiKeyInput,
): Promise<{ api_key: ApiKeyView; secret: string }> {
  // Keys are minted by a human session or by another delegated key; a service
  // key has no profile to attribute `created_by` to.
  if (caller.kind === "service") throw new DomainError("insufficient_scope");

  const actor = actorUserId(caller);
  const scopes = validateScopes(input.scopes);
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80) {
    throw new DomainError("validation_failed", "name must be 1..80 characters");
  }

  const now = deps.now?.() ?? new Date();
  const expiresAt = input.expires_at ? new Date(input.expires_at) : null;
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime())) {
    throw new DomainError("validation_failed", "expires_at must be in the future");
  }

  if (input.kind === "service") {
    // Minting a service credential is a panel action: a delegated key must
    // never escalate into a service key, even if its owner is super_admin.
    if (caller.kind !== "session" || caller.role !== "super_admin") {
      throw new DomainError("insufficient_scope");
    }
    if (input.user_id !== undefined) {
      throw new DomainError("validation_failed", "a service key has no owner");
    }
    const roleCap = input.role_cap ?? "admin";
    assertServiceScopes(scopes, roleCap);

    const secret = newApiKeyToken("service");
    const api_key = await insertKey(deps.db, {
      secret,
      kind: "service",
      name,
      scopes,
      userId: null,
      roleCap,
      actor,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    });
    return { api_key, secret };
  }

  // Delegated keys never carry a role cap: they always act as a plain user.
  if (input.role_cap !== undefined) {
    throw new DomainError("validation_failed", "role_cap is not allowed for a delegated key");
  }
  if (
    input.user_id !== undefined &&
    !(caller.kind === "session" && caller.role === "super_admin")
  ) {
    throw new DomainError("insufficient_scope", "only a super_admin may name the owner");
  }

  const ownerId = input.user_id ?? actor;
  await assertActiveOwner(deps.db, ownerId);
  const effective = await delegatedCreationScopes(deps.db, caller, ownerId, scopes);
  if (effective.length === 0) {
    throw new DomainError(
      "validation_failed",
      "no requested scope is allowed for a delegated key",
    );
  }

  const secret = newApiKeyToken("delegated");
  return withTx(deps, async (db) => {
    // The check and the insert share a transaction and a per-owner advisory
    // lock, so two concurrent creations cannot both take the fifth slot.
    await db.query("select pg_advisory_xact_lock(hashtext($1))", [`api_keys:${ownerId}`]);
    const { rows } = await db.query(
      `select count(*)::int as n from public.api_keys
        where user_id = $1 and kind = 'delegated' and revoked_at is null
          and (expires_at is null or expires_at > now())`,
      [ownerId],
    );
    if (Number(rows[0]?.n ?? 0) >= MAX_ACTIVE_DELEGATED_KEYS) throw keyLimitError();

    const api_key = await insertKey(db, {
      secret,
      kind: "delegated",
      name,
      scopes: effective,
      userId: ownerId,
      roleCap: null,
      actor,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    });
    return { api_key, secret };
  });
}

export async function listApiKeys(
  deps: ApiKeysDeps,
  caller: Caller,
  page: ApiKeyPage,
): Promise<ApiKeyList> {
  if (caller.kind === "service") throw new DomainError("insufficient_scope");
  const actor = actorUserId(caller);
  const superAdmin = isSuperAdmin(caller);

  // `user` only refines delegated keys: with `kind=service` it could only
  // return an empty list, so it is rejected instead of hiding the mistake.
  if (page.kind === "service" && page.user) {
    throw new DomainError("validation_failed", "user cannot be combined with kind=service");
  }
  // A non-super_admin can only ever list their own keys; asking for someone
  // else's is indistinguishable from a missing resource.
  if (page.user && !superAdmin && page.user !== actor) throw new DomainError("not_found");

  const conditions: string[] = [];
  const params: unknown[] = [];
  const owner = superAdmin ? page.user : actor;
  if (owner) {
    params.push(owner);
    conditions.push(`user_id = $${params.length}`);
  }
  if (page.kind && page.kind !== "all") {
    params.push(page.kind);
    conditions.push(`kind = $${params.length}`);
  }
  const where = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  params.push(page.limit, page.offset);

  const { rows } = await deps.db.query(
    `with total as (select count(*)::int as n from public.api_keys ${where}),
          page as (
            select ${VIEW_COLUMNS} from public.api_keys
             ${where}
             order by created_at desc, id desc
             limit $${params.length - 1} offset $${params.length}
          )
     select total.n as total, page.* from total left join page on true`,
    params,
  );
  const keys = rows.filter((row) => row.id !== null && row.id !== undefined);
  return {
    api_keys: keys.map(toView),
    total: Number(rows[0]?.total ?? 0),
  };
}

async function findVisibleKey(
  deps: ApiKeysDeps,
  caller: Caller,
  id: string,
): Promise<Record<string, unknown>> {
  const { rows } = await deps.db.query(`select ${VIEW_COLUMNS} from public.api_keys where id = $1`, [
    id,
  ]);
  const row = rows[0];
  if (!row) throw new DomainError("not_found");
  if (!isSuperAdmin(caller) && String(row.user_id) !== actorUserId(caller)) {
    // Deliberately indistinguishable from a missing key.
    throw new DomainError("not_found");
  }
  return row;
}

export async function getApiKey(deps: ApiKeysDeps, caller: Caller, id: string): Promise<ApiKeyView> {
  if (caller.kind === "service") throw new DomainError("insufficient_scope");
  return toView(await findVisibleKey(deps, caller, id));
}

export async function revokeApiKey(deps: ApiKeysDeps, caller: Caller, id: string): Promise<void> {
  if (caller.kind === "service" && caller.roleCap !== "super_admin") {
    throw new DomainError("insufficient_scope");
  }
  const row = await findVisibleKey(deps, caller, id);
  if (row.revoked_at !== null && row.revoked_at !== undefined) return;
  await deps.db.query(
    "update public.api_keys set revoked_at = now() where id = $1 and revoked_at is null",
    [id],
  );
}

/**
 * Edits `name`, `scopes` or `expires_at` of an existing key (never `kind`,
 * `role_cap` or `user_id`, and never the secret or `last_used_at`). Re-scoping
 * repeats the creation rules: a service key stays inside its stored cap and a
 * delegated key is trimmed to the owner's allowlist and live module grants.
 */
export async function updateApiKey(
  deps: ApiKeysDeps,
  caller: Caller,
  id: string,
  patch: UpdateApiKeyInput,
): Promise<ApiKeyView> {
  if (caller.kind === "service") throw new DomainError("insufficient_scope");

  const row = await findVisibleKey(deps, caller, id);
  const kind = String(row.kind) as ApiKeyKind;

  if (row.revoked_at !== null && row.revoked_at !== undefined) {
    throw new DomainError("conflict", "a revoked API key cannot be edited", { code: "revoked" });
  }
  // Ownership already hid it; this keeps a future looser lookup from letting a
  // plain admin edit the instance credential.
  if (kind === "service" && !isSuperAdmin(caller)) throw new DomainError("not_found");

  const now = deps.now?.() ?? new Date();
  const assignments: string[] = [];
  const params: unknown[] = [];

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 1 || name.length > 80) {
      throw new DomainError("validation_failed", "name must be 1..80 characters");
    }
    params.push(name);
    assignments.push(`name = $${params.length}`);
  }

  if (patch.scopes !== undefined) {
    const scopes = validateScopes(patch.scopes);
    let effective: string[];
    if (kind === "service") {
      const cap = (row.role_cap ?? "admin") as ApiKeyRoleCap;
      assertServiceScopes(scopes, cap);
      effective = scopes;
    } else {
      effective = await delegatedCreationScopes(deps.db, caller, String(row.user_id), scopes);
      if (effective.length === 0) {
        throw new DomainError(
          "validation_failed",
          "no requested scope is allowed for a delegated key",
        );
      }
    }
    params.push(effective);
    assignments.push(`scopes = $${params.length}`);
  }

  if (patch.expires_at !== undefined) {
    const expiresAt = new Date(patch.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
      throw new DomainError("validation_failed", "expires_at must be in the future");
    }
    // An expired key can only be extended: the new value is in the future by
    // the check above, so it always lands after the stored one.
    const current = row.expires_at === null || row.expires_at === undefined
      ? null
      : new Date(toIso(row.expires_at));
    if (current && current.getTime() <= now.getTime() && expiresAt.getTime() <= current.getTime()) {
      throw new DomainError("validation_failed", "an expired key can only be extended");
    }
    params.push(expiresAt.toISOString());
    assignments.push(`expires_at = $${params.length}`);
  }

  // Nothing to change: the route schema already requires a field.
  if (assignments.length === 0) return toView(row);

  params.push(id);
  const { rows } = await deps.db.query(
    `update public.api_keys set ${assignments.join(", ")}
      where id = $${params.length} and revoked_at is null
      returning ${VIEW_COLUMNS}`,
    params,
  );
  const updated = rows[0];
  // The key was visible above, so a vanished row means it was revoked in
  // between: report the same conflict as the pre-check.
  if (!updated) {
    throw new DomainError("conflict", "a revoked API key cannot be edited", { code: "revoked" });
  }
  return toView(updated);
}

/**
 * Resolves an opaque bearer token. Revocation and expiry are checked in the
 * same statement that records `last_used_at`, so the next request after a
 * revocation is already rejected (tokens spec §5/§6). Never caches the secret.
 */
export async function resolveApiKey(
  deps: ApiKeysDeps,
  token: string,
): Promise<ApiKeyResolution | null> {
  if (!token.startsWith(SERVICE_PREFIX) && !token.startsWith(DELEGATED_PREFIX)) return null;
  if (token.length > 200) return null;

  const { rows } = await deps.db.query(
    `with resolved as (
       select id, kind, scopes, role_cap, user_id
         from public.api_keys
        where key_hash = $1
          and revoked_at is null
          and (expires_at is null or expires_at > now())
     ), touched as (
       -- Throttle the audit write: one row update per key per minute, not per request.
       update public.api_keys
          set last_used_at = now()
        where id in (select id from resolved)
          and (last_used_at is null or last_used_at < now() - interval '60 seconds')
       returning id
     )
     select * from resolved`,
    [hashApiKeyToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    kind: String(row.kind) as ApiKeyKind,
    scopes: (row.scopes as string[] | null) ?? [],
    roleCap: row.role_cap === null ? null : (String(row.role_cap) as ApiKeyRoleCap),
    userId: row.user_id === null ? null : String(row.user_id),
  };
}
