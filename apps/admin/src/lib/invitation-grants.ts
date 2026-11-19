import { redirect } from "next/navigation";
import { invitationQuota, type InvitationQuota } from "@027apps/core/invitations/quota.js";
import { listInvitationGrantsRoute } from "@027apps/core/invitations/api.js";
import { getInfra } from "@/lib/api/door";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type { InvitationQuota };

/** `GrantView` from `packages/core/src/invitations/requests.ts`. */
export interface InvitationGrant {
  id: string;
  user_id: string;
  amount: number;
  granted_by: { id: string; display_name: string } | null;
  request_id: string | null;
  reason: string | null;
  revoked_at: string | null;
  created_at: string;
}

export type InvitationFailure = { ok: false; code?: string; requestId?: string };

export type MemberInvitationResult =
  | { ok: true; grants: InvitationGrant[]; quota: InvitationQuota }
  | InvitationFailure;

type RouteSuccess = { ok: true; body: Record<string, unknown>; requestId?: string };
type RouteCall = RouteSuccess | InvitationFailure;

const INTERNAL_ORIGIN = "http://panel.internal";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  return readString(value);
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return readString(value) ?? null;
}

function readAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : null;
}

function readGrantedBy(value: unknown): InvitationGrant["granted_by"] | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const id = readString(value.id);
  const displayName = readString(value.display_name);
  if (!id || !displayName) return undefined;
  return { id, display_name: displayName };
}

function readGrant(value: unknown): InvitationGrant | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const userId = readString(value.user_id);
  const amount = readAmount(value.amount);
  const grantedBy = readGrantedBy(value.granted_by);
  const revokedAt = readDate(value.revoked_at);
  const createdAt = readString(value.created_at);
  if (!id || !userId || amount === null || grantedBy === undefined) return null;
  if (revokedAt === undefined || !createdAt) return null;
  return {
    id,
    user_id: userId,
    amount,
    granted_by: grantedBy,
    request_id: readNullableString(value.request_id),
    reason: readNullableString(value.reason),
    revoked_at: revokedAt,
    created_at: createdAt,
  };
}

function errorFields(value: unknown, headerRequestId: string | undefined, status: number): InvitationFailure {
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
 * In-process call to the grants route: a fixed internal origin and the session
 * as Bearer, never a URL from the client's headers. Only the public envelope
 * fields survive a failure.
 */
async function callRoute(
  handler: (req: Request, userId: string) => Promise<Response>,
  path: string,
  token: string,
  userId: string,
): Promise<RouteCall> {
  let res: Response;
  try {
    res = await handler(
      new Request(`${INTERNAL_ORIGIN}${path}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
      userId,
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

/**
 * One member's invitation state for the ficha: the grants list (active and
 * revoked, via the real `GET /users/{id}/invitation-grants` route) and the live
 * quota, read with the same Core query the member endpoints use. The quota has
 * no route of its own, so the panel reads it in process from the same DB port
 * the settings service uses.
 */
export async function loadMemberInvitation(userId: string): Promise<MemberInvitationResult> {
  const token = await sessionToken();
  const deps = await invitationsRouteDeps();
  const call = await callRoute(
    listInvitationGrantsRoute(deps),
    `/api/v1/users/${encodeURIComponent(userId)}/invitation-grants`,
    token,
    userId,
  );
  if (!call.ok) return call;

  if (!Array.isArray(call.body.grants)) {
    return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  }

  const grants: InvitationGrant[] = [];
  for (const entry of call.body.grants) {
    const grant = readGrant(entry);
    if (!grant) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
    grants.push(grant);
  }

  const { settingsDeps } = await getInfra();
  const quota = await invitationQuota(settingsDeps.db, userId);

  return { ok: true, grants, quota };
}
