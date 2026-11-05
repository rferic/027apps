import { createHash, randomBytes } from "node:crypto";
import { DomainError } from "../errors";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";

/**
 * Machine tokens (tokens spec §3.2/§3.3/§6). A service key acts as the
 * instance with a role cap; a delegated key acts as its owner with the
 * intersection of its scopes and the user's permissions. Only the SHA-256 of
 * the token is stored and the secret is returned exactly once at creation.
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
  expires_at?: string;
};

export type ApiKeyResolution = {
  id: string;
  kind: ApiKeyKind;
  scopes: string[];
  roleCap: ApiKeyRoleCap | null;
  userId: string | null;
};

const SERVICE_PREFIX = "027_svc_";
const DELEGATED_PREFIX = "027_usr_";
const MAX_SCOPES = 100;
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
  if (caller.kind === "service" || caller.kind === "delegated") return caller.roleCap === "super_admin";
  return false;
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
  // Service keys are created by a super_admin from the panel; service callers
  // have no profile to attribute `created_by` to.
  if (caller.kind === "service") throw new DomainError("insufficient_scope");

  const actor = actorUserId(caller);
  const scopes = validateScopes(input.scopes);
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80) {
    throw new DomainError("validation_failed", "name must be 1..80 characters");
  }

  let roleCap: ApiKeyRoleCap | null = null;
  let userId: string | null = null;
  if (input.kind === "service") {
    // Minting a service credential is a panel action: a delegated key must
    // never escalate into a service key, even if its owner is super_admin.
    if (caller.kind !== "session" || caller.role !== "super_admin") {
      throw new DomainError("insufficient_scope");
    }
    roleCap = input.role_cap ?? "admin";
  } else {
    userId = actor;
  }

  const now = deps.now?.() ?? new Date();
  const expiresAt = input.expires_at ? new Date(input.expires_at) : null;
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime())) {
    throw new DomainError("validation_failed", "expires_at must be in the future");
  }

  const secret = newApiKeyToken(input.kind);
  const { rows } = await deps.db.query(
    `insert into public.api_keys
       (key_hash, kind, name, scopes, user_id, role_cap, created_by, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning ${VIEW_COLUMNS}`,
    [
      hashApiKeyToken(secret),
      input.kind,
      name,
      scopes,
      userId,
      roleCap,
      actor,
      expiresAt ? expiresAt.toISOString() : null,
    ],
  );
  return { api_key: toView(rows[0]!), secret };
}

export async function listApiKeys(deps: ApiKeysDeps, caller: Caller): Promise<ApiKeyView[]> {
  if (caller.kind === "service") throw new DomainError("insufficient_scope");
  const actor = actorUserId(caller);

  const { rows } = isSuperAdmin(caller)
    ? await deps.db.query(
        `select ${VIEW_COLUMNS} from public.api_keys order by created_at desc, id desc`,
      )
    : await deps.db.query(
        `select ${VIEW_COLUMNS} from public.api_keys
          where user_id = $1 order by created_at desc, id desc`,
        [actor],
      );
  return rows.map(toView);
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
