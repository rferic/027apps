import { redirect } from "next/navigation";
import { userModulesRoute } from "@027apps/core/users/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INTERNAL_ORIGIN = "http://panel.internal";

/** A module granted and active for a profile (`GET /api/v1/users/{id}/modules`). */
export type UserModule = { key: string; name: string };

export type UserModulesFailure = { ok: false; code?: string; requestId?: string };

export type UserModulesResult = { ok: true; modules: UserModule[] } | UserModulesFailure;

/**
 * Modules of a key's owner: only a delegated key has one, and a service key
 * never offers module permissions.
 */
export async function loadModulesForOwner(apiKey: {
  kind: string;
  user_id: string | null;
}): Promise<UserModulesResult | null> {
  if (apiKey.kind !== "delegated" || !apiKey.user_id) return null;
  return loadUserModules(apiKey.user_id);
}

/** The offered modules of a result, or none while the load failed or was skipped. */
export function offeredModuleList(
  result: UserModulesResult | null,
): readonly UserModule[] {
  return result?.ok ? result.modules : [];
}

/** The failure of a load result, if it failed. */
export function modulesFailure(result: UserModulesResult | null): UserModulesFailure | null {
  if (!result || result.ok) return null;
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function failure(
  body: unknown,
  headerRequestId: string | undefined,
  status: number,
): UserModulesFailure {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const code = readString(error.code) ?? (status === 404 ? "not_found" : undefined);
  const requestId = readString(error.request_id) ?? headerRequestId;
  return {
    ok: false,
    ...(code ? { code } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

function malformed(requestId?: string): UserModulesFailure {
  return { ok: false, ...(requestId ? { requestId } : {}) };
}

function parseModules(body: unknown, requestId?: string): UserModulesResult {
  if (!isRecord(body) || !Array.isArray(body.modules)) return malformed(requestId);
  const modules: UserModule[] = [];
  for (const entry of body.modules) {
    if (!isRecord(entry)) return malformed(requestId);
    const key = readString(entry.key);
    const name = readString(entry.name);
    if (!key || !name) return malformed(requestId);
    modules.push({ key, name });
  }
  return { ok: true, modules };
}

async function sessionToken(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) redirect("/login");
  return token;
}

/**
 * In-process call to the Core modules route, with the session as Bearer and the
 * fixed internal origin (never the request `host`).
 *
 * Degradation is deliberate and narrow: a transport failure answers an empty
 * list so the key form still renders. A 4xx/5xx is a real refusal and is
 * propagated, so the form can show it instead of silently dropping the owner's
 * module permissions.
 */
export async function loadUserModules(userId: string): Promise<UserModulesResult> {
  const token = await sessionToken();
  const { deps, auth, settingsDeps } = await getInfra();
  const handler = userModulesRoute({
    door: deps,
    auth,
    users: { db: settingsDeps.db, withTransaction: withTransactionClient },
  });
  const request = new Request(
    `${INTERNAL_ORIGIN}/api/v1/users/${encodeURIComponent(userId)}/modules`,
    { headers: { authorization: `Bearer ${token}` } },
  );

  let res: Response;
  try {
    res = await handler(request, userId);
  } catch {
    return { ok: true, modules: [] };
  }

  const headerRequestId = res.headers.get("x-request-id") ?? undefined;
  let body: unknown;
  try {
    body = JSON.parse(await res.text());
  } catch {
    body = undefined;
  }

  if (!res.ok) return failure(body, headerRequestId, res.status);
  return parseModules(body, headerRequestId);
}
