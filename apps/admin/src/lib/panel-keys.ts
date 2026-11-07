import { redirect } from "next/navigation";
import { apiKeysRoute } from "@027apps/core/api-keys/api.js";
import type { QueryClient } from "@027apps/core/api/rate-limit-storage.js";
import { apiKeysRouteDeps } from "@/lib/api-keys-route-deps";
import { PANEL_PAGE_SIZE } from "@/lib/panel-pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INTERNAL_ORIGIN = "http://panel.internal";

export type ApiKeyKind = "service" | "delegated";
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

export type ApiKeysFailure = { ok: false; code?: string; requestId?: string };
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
  return {
    ok: false,
    ...(code ? { code } : {}),
    ...(requestId ? { requestId } : {}),
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
async function callRoute(
  handler: (req: Request) => Promise<Response>,
  path: string,
  token: string,
): Promise<RouteCall> {
  let res: Response;
  try {
    res = await handler(
      new Request(`${INTERNAL_ORIGIN}${path}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
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

/** GET /api/v1/api-keys — own keys, or every key for a super_admin, one page. */
export async function loadApiKeys(input: {
  offset: number;
  limit?: number;
}): Promise<ApiKeysList> {
  const token = await sessionToken();
  const deps = await apiKeysRouteDeps();
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? PANEL_PAGE_SIZE));
  params.set("offset", String(Math.max(0, input.offset)));
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
    owner:
      row.kind === "service"
        ? "Instance"
        : ((row.user_id && ownerNames.get(row.user_id)) || row.user_id || "—"),
  }));
  const total = readCount(call.body.total);
  if (total === null) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  return { ok: true, apiKeys, total };
}
