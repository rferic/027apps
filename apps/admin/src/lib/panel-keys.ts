import { redirect } from "next/navigation";
import { apiKeyRoute, apiKeysRoute, updateApiKeyRoute } from "@027apps/core/api-keys/api.js";
import type { QueryClient } from "@027apps/core/api/rate-limit-storage.js";
import { usersRoute, type UsersRouteDeps } from "@027apps/core/users/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";
import { apiKeysRouteDeps } from "@/lib/api-keys-route-deps";
import { PANEL_PAGE_SIZE } from "@/lib/panel-pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INTERNAL_ORIGIN = "http://panel.internal";

export type ApiKeyKind = "service" | "delegated";
/** `all` is the explicit opt-out of the kind filter in the list. */
export type ApiKeyKindFilter = "all" | ApiKeyKind;
/** Derived lifecycle state; the Core applies it, the panel never re-filters. */
export type ApiKeyStateFilter = "all" | "active" | "revoked" | "expired";
export type ApiKeyRoleCap = "admin" | "super_admin";

/** `ApiKeyView` from `packages/core/src/api-keys/service.ts` (never the secret). */
export interface ApiKeyRow {
  id: string;
  kind: ApiKeyKind;
  name: string;
  scopes: string[];
  user_id: string | null;
  /** Profile display name of the owner; "Instance" for service keys. */
  owner: string;
  roleCap: ApiKeyRoleCap | null;
  /** Contract prefix (`027_svc_` / `027_usr_`), not the stored key. */
  prefix: string;
  expiresAt: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export type ApiKeysFailure = {
  ok: false;
  code?: string;
  requestId?: string;
  /** Domain detail the panel needs to explain a conflict (`revoked`). */
  details?: { code?: string };
};
export type ApiKeysList = { ok: true; apiKeys: ApiKeyRow[]; total: number } | ApiKeysFailure;

type RouteSuccess = { ok: true; body: Record<string, unknown>; requestId?: string };
type RouteCall = RouteSuccess | ApiKeysFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return readString(value);
}

function readKind(value: unknown): ApiKeyKind | null {
  return value === "service" || value === "delegated" ? value : null;
}

function readRoleCap(value: unknown): ApiKeyRoleCap | null | undefined {
  if (value === null) return null;
  return value === "admin" || value === "super_admin" ? value : undefined;
}

function readScopes(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const scopes: string[] = [];
  for (const entry of value) {
    const scope = readString(entry);
    if (!scope) return null;
    scopes.push(scope);
  }
  return scopes;
}

interface KeyIdentity {
  id: string;
  kind: ApiKeyKind;
  name: string;
  scopes: string[];
  prefix: string;
  created_at: string;
}

function readKeyIdentity(value: Record<string, unknown>): KeyIdentity | null {
  const id = readString(value.id);
  const kind = readKind(value.kind);
  const name = readString(value.name);
  const scopes = readScopes(value.scopes);
  const prefix = readString(value.prefix);
  const createdAt = readString(value.created_at);
  if (!id || !kind || !name || !prefix || !createdAt) return null;
  if (!scopes) return null;
  return { id, kind, name, scopes, prefix, created_at: createdAt };
}

interface KeyDates {
  user_id: string | null;
  roleCap: ApiKeyRoleCap | null;
  expiresAt: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

function readKeyDates(value: Record<string, unknown>): KeyDates | null {
  const userId = readNullableString(value.user_id);
  const roleCap = readRoleCap(value.role_cap);
  const expiresAt = readNullableString(value.expires_at);
  const revokedAt = readNullableString(value.revoked_at);
  const lastUsedAt = readNullableString(value.last_used_at);
  if (userId === undefined || roleCap === undefined) return null;
  if (expiresAt === undefined || revokedAt === undefined || lastUsedAt === undefined) return null;
  return {
    user_id: userId,
    roleCap,
    expiresAt,
    revoked_at: revokedAt,
    last_used_at: lastUsedAt,
  };
}

type ParsedApiKey = Omit<ApiKeyRow, "owner">;

function readApiKey(value: unknown): ParsedApiKey | null {
  if (!isRecord(value)) return null;
  const identity = readKeyIdentity(value);
  const dates = readKeyDates(value);
  if (!identity || !dates) return null;
  return { ...identity, ...dates };
}

/**
 * Display names for the delegated keys' owners, read through the same service
 * pool as the rest of the panel. A profile read failure must not hide the
 * credentials an admin may need to revoke: the caller falls back to the id.
 */
async function loadOwnerNames(
  db: QueryClient,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (userIds.length === 0) return names;

  try {
    const { rows } = await db.query(
      "select id, display_name from public.profiles where id = any($1::uuid[])",
      [userIds],
    );
    for (const row of rows) {
      const id = readString(row.id);
      const displayName = readString(row.display_name);
      if (id && displayName) names.set(id, displayName);
    }
  } catch {
    // Fall back to the raw user id below.
  }
  return names;
}

function errorFields(
  value: unknown,
  headerRequestId: string | undefined,
  status: number,
): ApiKeysFailure {
  const error = isRecord(value) && isRecord(value.error) ? value.error : {};
  const code = readString(error.code) ?? (status === 404 ? "not_found" : undefined);
  const requestId = readString(error.request_id) ?? headerRequestId;
  const details = isRecord(error.details) ? error.details : {};
  const detailCode = readString(details.code);
  return {
    ok: false,
    ...(code ? { code } : {}),
    ...(requestId ? { requestId } : {}),
    ...(detailCode ? { details: { code: detailCode } } : {}),
  };
}

async function sessionToken(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) redirect("/login");
  return token;
}

/**
 * In-process call to the Core API keys route: a fixed internal origin (never
 * the client's `host`), the session as Bearer, and no secret anywhere in the
 * request or the parsed result.
 */
function routeRequest(
  path: string,
  token: string,
  write?: { method: "PATCH"; body: string },
): Request {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (write) headers["content-type"] = "application/json";
  return new Request(`${INTERNAL_ORIGIN}${path}`, {
    ...(write ? { method: write.method, body: write.body } : {}),
    headers,
  });
}

async function callRoute(
  handler: (req: Request) => Promise<Response>,
  path: string,
  token: string,
  write?: { method: "PATCH"; body: string },
): Promise<RouteCall> {
  let res: Response;
  try {
    res = await handler(routeRequest(path, token, write));
  } catch {
    return { ok: false };
  }

  const headerRequestId = res.headers.get("x-request-id") ?? undefined;
  let body: unknown;
  try {
    body = JSON.parse(await res.text());
  } catch {
    return {
      ok: false,
      ...(res.status === 404 ? { code: "not_found" } : {}),
      ...(headerRequestId ? { requestId: headerRequestId } : {}),
    };
  }

  if (!res.ok) return errorFields(body, headerRequestId, res.status);
  if (!isRecord(body)) {
    return { ok: false, ...(headerRequestId ? { requestId: headerRequestId } : {}) };
  }
  return { ok: true, body, ...(headerRequestId ? { requestId: headerRequestId } : {}) };
}

function listParams(input: {
  offset: number;
  limit?: number;
  kind?: ApiKeyKindFilter;
  user?: string;
  state?: ApiKeyStateFilter;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? PANEL_PAGE_SIZE));
  params.set("offset", String(Math.max(0, input.offset)));
  if (input.kind && input.kind !== "all") params.set("kind", input.kind);
  if (input.user) params.set("user", input.user);
  if (input.state) params.set("state", input.state);
  return params;
}

/** GET /api/v1/api-keys — own keys, or every key for a super_admin, one page. */
export async function loadApiKeys(input: {
  offset: number;
  limit?: number;
  kind?: ApiKeyKindFilter;
  user?: string;
  state?: ApiKeyStateFilter;
}): Promise<ApiKeysList> {
  const token = await sessionToken();
  const deps = await apiKeysRouteDeps();
  const params = listParams(input);
  const call = await callRoute(apiKeysRoute(deps), `/api/v1/api-keys?${params.toString()}`, token);
  if (!call.ok) return call;
  if (!Array.isArray(call.body.api_keys)) {
    return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  }

  const parsed: ParsedApiKey[] = [];
  for (const entry of call.body.api_keys) {
    const row = readApiKey(entry);
    // One malformed row invalidates the list: a partial table would look
    // complete while hiding credentials.
    if (!row) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
    parsed.push(row);
  }

  const userIds = [
    ...new Set(
      parsed
        .filter((row) => row.kind === "delegated" && row.user_id !== null)
        .map((row) => row.user_id as string),
    ),
  ];
  const ownerNames = await loadOwnerNames(deps.apiKeys.db, userIds);

  const apiKeys: ApiKeyRow[] = parsed.map((row) => ({
    ...row,
    owner: ownerLabel(row, ownerNames),
  }));
  const total = readCount(call.body.total);
  if (total === null) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  return { ok: true, apiKeys, total };
}

function ownerLabel(row: ParsedApiKey, names: ReadonlyMap<string, string>): string {
  if (row.kind === "service") return "Instance";
  return (row.user_id && names.get(row.user_id)) || row.user_id || "—";
}

export type ApiKeyDetail = { ok: true; apiKey: ApiKeyRow } | ApiKeysFailure;

/** Editable fields of a key; the kind, cap and owner are immutable. */
export interface ApiKeyUpdate {
  name?: string;
  scopes?: string[];
  /** `null` removes the expiry: the key then never expires. */
  expires_at?: string | null;
}

/**
 * Resolves the owner of a single parsed row. The profile read is best effort:
 * it never turns a readable key into an error.
 */
async function withOwner(db: QueryClient, row: ParsedApiKey): Promise<ApiKeyRow> {
  const userIds = row.kind === "delegated" && row.user_id ? [row.user_id] : [];
  const ownerNames = await loadOwnerNames(db, userIds);
  return { ...row, owner: ownerLabel(row, ownerNames) };
}

/**
 * GET /api/v1/api-keys/{id} — the same in-process route as the list, so the
 * role gate and the guard cannot disagree. The secret never comes back.
 */
export async function loadKey(id: string): Promise<ApiKeyDetail> {
  const token = await sessionToken();
  const deps = await apiKeysRouteDeps();
  const handler = apiKeyRoute(deps);
  const call = await callRoute(
    (req) => handler(req, id),
    `/api/v1/api-keys/${encodeURIComponent(id)}`,
    token,
  );
  if (!call.ok) return call;

  const row = readApiKey(call.body.api_key);
  if (!row) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  return { ok: true, apiKey: await withOwner(deps.apiKeys.db, row) };
}

/**
 * PATCH /api/v1/api-keys/{id} — the route owns validation, immutability and
 * revocation (`409 conflict` with `details.code = "revoked"`), so the panel
 * only forwards the patch and maps the envelope back.
 */
export async function updateKey(id: string, patch: ApiKeyUpdate): Promise<ApiKeyDetail> {
  const token = await sessionToken();
  const deps = await apiKeysRouteDeps();
  const handler = updateApiKeyRoute(deps);
  const call = await callRoute(
    (req) => handler(req, id),
    `/api/v1/api-keys/${encodeURIComponent(id)}`,
    token,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  if (!call.ok) return call;

  const row = readApiKey(call.body.api_key);
  if (!row) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  return { ok: true, apiKey: await withOwner(deps.apiKeys.db, row) };
}

/** A selectable owner for a delegated key; active users only. */
export interface ApiKeyOwner {
  id: string;
  name: string;
}

export type ApiKeyOwners = { ok: true; owners: ApiKeyOwner[] } | ApiKeysFailure;

async function usersRouteDeps(): Promise<UsersRouteDeps> {
  const { deps, auth, settingsDeps } = await getInfra();
  return {
    door: deps,
    auth,
    users: { db: settingsDeps.db, withTransaction: withTransactionClient },
  };
}

/**
 * GET /api/v1/users?state=active&limit=100 — the super_admin owner selector.
 * The page never builds this from client input, and `limit=100` is the API cap.
 */
export async function loadApiKeyOwners(): Promise<ApiKeyOwners> {
  const token = await sessionToken();
  const params = new URLSearchParams({ state: "active", limit: "100", offset: "0" });
  const call = await callRoute(
    usersRoute(await usersRouteDeps()),
    `/api/v1/users?${params.toString()}`,
    token,
  );
  if (!call.ok) return call;
  if (!Array.isArray(call.body.users)) {
    return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  }

  const owners: ApiKeyOwner[] = [];
  for (const entry of call.body.users) {
    if (!isRecord(entry)) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
    const id = readString(entry.id);
    if (!id) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
    owners.push({ id, name: readString(entry.display_name) ?? id });
  }
  return { ok: true, owners };
}

/**
 * Active delegated keys per owner, for the five-key hint. A failure only hides
 * the hint: the API still enforces the limit, so the form is not blocked by it.
 */
export async function loadActiveDelegatedCounts(): Promise<Record<string, number>> {
  const { settingsDeps } = await getInfra();
  try {
    const { rows } = await settingsDeps.db.query(
      `select user_id, count(*)::int as n
         from public.api_keys
        where kind = 'delegated' and revoked_at is null
          and (expires_at is null or expires_at > now())
        group by user_id`,
    );
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const id = readString(row.user_id);
      const count = readCount(row.n);
      if (id && count !== null) counts[id] = count;
    }
    return counts;
  } catch {
    return {};
  }
}
