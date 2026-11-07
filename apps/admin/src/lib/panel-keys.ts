import { redirect } from "next/navigation";
import { apiKeysRoute } from "@027apps/core/api-keys/api.js";
import { apiKeysRouteDeps } from "@/lib/api-keys-route-deps";
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
  role_cap: ApiKeyRoleCap | null;
  /** Contract prefix (`027_svc_` / `027_usr_`), not the stored key. */
  prefix: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export type ApiKeysFailure = { ok: false; code?: string; requestId?: string };
export type ApiKeysList = { ok: true; apiKeys: ApiKeyRow[] } | ApiKeysFailure;

type RouteSuccess = { ok: true; body: Record<string, unknown>; requestId?: string };
type RouteCall = RouteSuccess | ApiKeysFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
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
  role_cap: ApiKeyRoleCap | null;
  expires_at: string | null;
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
    role_cap: roleCap,
    expires_at: expiresAt,
    revoked_at: revokedAt,
    last_used_at: lastUsedAt,
  };
}

function readApiKey(value: unknown): ApiKeyRow | null {
  if (!isRecord(value)) return null;
  const identity = readKeyIdentity(value);
  const dates = readKeyDates(value);
  if (!identity || !dates) return null;
  return { ...identity, ...dates };
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

/** GET /api/v1/api-keys — own keys, or every key for a super_admin. */
export async function loadApiKeys(): Promise<ApiKeysList> {
  const token = await sessionToken();
  const call = await callRoute(
    apiKeysRoute(await apiKeysRouteDeps()),
    "/api/v1/api-keys",
    token,
  );
  if (!call.ok) return call;
  if (!Array.isArray(call.body.api_keys)) {
    return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  }

  const apiKeys: ApiKeyRow[] = [];
  for (const entry of call.body.api_keys) {
    const row = readApiKey(entry);
    // One malformed row invalidates the list: a partial table would look
    // complete while hiding credentials.
    if (!row) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
    apiKeys.push(row);
  }
  return { ok: true, apiKeys };
}
