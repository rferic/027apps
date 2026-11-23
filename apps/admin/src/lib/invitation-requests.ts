import { redirect } from "next/navigation";
import { listInvitationRequestsRoute } from "@027apps/core/invitations/api.js";
import type { InvitationQuota } from "@027apps/core/invitations/quota.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PANEL_PAGE_SIZE } from "@/lib/panel-pagination";

/**
 * Quota requests (sprint 18 spec §6.4/§7.4): the panel lists them (pending
 * first, as the Core orders them), approves with a seat amount and rejects
 * with an optional reason. Reads go through the in-process Core route with the
 * session as Bearer; writes are same-origin fetches that carry the cookie and
 * never a token.
 */

export type InvitationRequestState = "pending" | "approved" | "rejected" | "cancelled";
export type InvitationRequestFilter = InvitationRequestState | "all";

export interface InvitationRequestRequester {
  id: string;
  display_name: string;
  level: number | null;
}

export interface InvitationRequestRow {
  id: string;
  requester: InvitationRequestRequester;
  amount: number;
  reason: string | null;
  state: InvitationRequestState;
  granted_amount: number | null;
  resolution_reason: string | null;
  resolved_by: { id: string; display_name: string } | null;
  resolved_at: string | null;
  created_at: string;
  quota: InvitationQuota;
}

export type InvitationRequestFailure = { ok: false; code?: string; requestId?: string };

export type InvitationRequestList =
  | { ok: true; requests: InvitationRequestRow[]; total: number }
  | InvitationRequestFailure;

type RouteSuccess = { ok: true; body: Record<string, unknown>; requestId?: string };
type RouteCall = RouteSuccess | InvitationRequestFailure;

const INTERNAL_ORIGIN = "http://panel.internal";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/** `null` is valid (a member with no level); anything else non-numeric reads malformed. */
function readLevel(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return readString(value) ?? null;
}

function readState(value: unknown): InvitationRequestState | null {
  return value === "pending" || value === "approved" || value === "rejected" || value === "cancelled"
    ? value
    : null;
}

function readPerson(value: unknown): { id: string; display_name: string } | null | undefined {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return undefined;
  const id = readString(value.id);
  const displayName = readString(value.display_name);
  if (!id || !displayName) return undefined;
  return { id, display_name: displayName };
}

function readRequester(value: unknown): InvitationRequestRequester | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const displayName = readString(value.display_name);
  const level = readLevel(value.level);
  if (!id || !displayName) return null;
  if (level === undefined) return null;
  return { id, display_name: displayName, level };
}

function readQuota(value: unknown): InvitationQuota | null {
  if (!isRecord(value)) return null;
  const level = readLevel(value.level);
  const base = readCount(value.base);
  const granted = readCount(value.granted);
  const used = readCount(value.used);
  const reserved = readCount(value.reserved);
  const remaining = readCount(value.remaining);
  if (level === undefined) return null;
  if (base === null || granted === null || used === null || reserved === null || remaining === null) {
    return null;
  }
  return {
    level,
    base,
    granted,
    used,
    reserved,
    remaining,
    unlimited: value.unlimited === true,
  };
}

function readRequest(value: unknown): InvitationRequestRow | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const requester = readRequester(value.requester);
  const amount = readCount(value.amount);
  const state = readState(value.state);
  const grantedAmount = readLevel(value.granted_amount);
  const resolvedBy = readPerson(value.resolved_by);
  const createdAt = readString(value.created_at);
  const quota = readQuota(value.quota);
  if (!id || !requester || amount === null || !state) return null;
  if (grantedAmount === undefined || resolvedBy === undefined || !createdAt || !quota) return null;
  return {
    id,
    requester,
    amount,
    reason: readNullableString(value.reason),
    state,
    granted_amount: grantedAmount,
    resolution_reason: readNullableString(value.resolution_reason),
    resolved_by: resolvedBy,
    resolved_at: readNullableString(value.resolved_at),
    created_at: createdAt,
    quota,
  };
}

function errorFields(
  value: unknown,
  headerRequestId: string | undefined,
  status: number,
): InvitationRequestFailure {
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

/** In-process call to the Core requests route: fixed origin, session Bearer. */
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

/**
 * GET /api/v1/invitation-requests — the admin list, pending first, with the
 * requester's live quota. The `state` filter is sent to the Core so the list
 * and the `total` describe the same selection.
 */
export async function loadInvitationRequests(input: {
  state?: InvitationRequestFilter;
  offset?: number;
  limit?: number;
}): Promise<InvitationRequestList> {
  const token = await sessionToken();
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? PANEL_PAGE_SIZE));
  params.set("offset", String(Math.max(0, input.offset ?? 0)));
  if (input.state && input.state !== "all") params.set("state", input.state);

  const call = await callRoute(
    listInvitationRequestsRoute(await invitationsRouteDeps()),
    `/api/v1/invitation-requests?${params.toString()}`,
    token,
  );
  if (!call.ok) return call;

  const list = readRequestList(call.body);
  return list ?? { ok: false, ...requestIdOf(call) };
}

/** Reads the list body; `null` means a malformed row or total. */
function readRequestList(body: Record<string, unknown>): InvitationRequestList | null {
  if (!Array.isArray(body.requests)) return null;
  const requests: InvitationRequestRow[] = [];
  for (const entry of body.requests) {
    const request = readRequest(entry);
    if (!request) return null;
    requests.push(request);
  }
  const total = readCount(body.total);
  if (total === null) return null;
  return { ok: true, requests, total };
}

function requestIdOf(call: RouteSuccess): { requestId?: string } {
  return call.requestId ? { requestId: call.requestId } : {};
}
