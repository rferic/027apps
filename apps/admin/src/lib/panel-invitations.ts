import { redirect } from "next/navigation";
import { invitationsRoute } from "@027apps/core/invitations/api.js";
import type { InvitationStatusFilter } from "@027apps/core/invitations/service.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";
import { PANEL_PAGE_SIZE } from "@/lib/panel-pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INTERNAL_ORIGIN = "http://panel.internal";

export type InvitationStatus = "pending" | "used" | "expired" | "revoked";

export interface InvitationRow {
  id: string;
  email: string;
  name: string;
  user_category_id: string | null;
  modules: string[];
  status: InvitationStatus;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export type InvitationFailure = { ok: false; code?: string; requestId?: string };

export type InvitationList =
  | { ok: true; invitations: InvitationRow[]; total: number }
  | InvitationFailure;

type RouteSuccess = { ok: true; body: Record<string, unknown>; requestId?: string };
type RouteCall = RouteSuccess | InvitationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  return readString(value);
}

function readCategoryId(value: unknown): string | null | undefined {
  if (value === null) return null;
  return readString(value);
}

function readStatus(value: unknown): InvitationStatus | null {
  return value === "pending" || value === "used" || value === "expired" || value === "revoked"
    ? value
    : null;
}

function readModules(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const modules: string[] = [];
  for (const entry of value) {
    const key = readString(entry);
    if (!key) return null;
    modules.push(key);
  }
  return modules;
}

function errorFields(
  value: unknown,
  headerRequestId: string | undefined,
  status: number,
): InvitationFailure {
  const error = isRecord(value) && isRecord(value.error) ? value.error : {};
  // A bare 404 still means "not found" to the page, even without an envelope.
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
 * In-process call to the Core invitations route. Same fixed internal origin
 * and Bearer session as every other panel read: never a URL derived from the
 * client's `host` header and never a self-fetch over the network.
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

function readInvitationBase(value: Record<string, unknown>): {
  id: string;
  email: string;
  name: string;
  expires_at: string;
  created_at: string;
} | null {
  const id = readString(value.id);
  const email = readString(value.email);
  const name = readString(value.name);
  const expiresAt = readString(value.expires_at);
  const createdAt = readString(value.created_at);
  if (!id) return null;
  if (!email) return null;
  if (!name) return null;
  if (!expiresAt) return null;
  if (!createdAt) return null;
  return { id, email, name, expires_at: expiresAt, created_at: createdAt };
}

function readInvitation(value: unknown): InvitationRow | null {
  if (!isRecord(value)) return null;
  const base = readInvitationBase(value);
  if (!base) return null;
  const categoryId = readCategoryId(value.user_category_id);
  const modules = readModules(value.modules);
  const status = readStatus(value.status);
  const usedAt = readDate(value.used_at);
  const revokedAt = readDate(value.revoked_at);
  if (categoryId === undefined) return null;
  if (modules === null) return null;
  if (status === null) return null;
  if (usedAt === undefined) return null;
  if (revokedAt === undefined) return null;
  return {
    ...base,
    user_category_id: categoryId,
    modules,
    status,
    used_at: usedAt,
    revoked_at: revokedAt,
  };
}

/** Query for one page: `status` only travels when the caller asks for one. */
function pageQuery(input: {
  offset: number;
  limit?: number;
  status?: InvitationStatusFilter;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? PANEL_PAGE_SIZE));
  params.set("offset", String(Math.max(0, input.offset)));
  if (input.status) params.set("status", input.status);
  return params;
}

/**
 * GET /api/v1/invitations with a page window and an optional status filter.
 * The route never returns the token: the plaintext exists only in the creation
 * response. The status travels to the Core so the page, `total` and the
 * paginator all describe the same filtered list.
 */
export async function loadInvitations(input: {
  offset: number;
  limit?: number;
  status?: InvitationStatusFilter;
}): Promise<InvitationList> {
  const token = await sessionToken();
  const params = pageQuery(input);

  const call = await callRoute(
    invitationsRoute(await invitationsRouteDeps()),
    `/api/v1/invitations?${params.toString()}`,
    token,
  );
  if (!call.ok) return call;

  if (!Array.isArray(call.body.invitations)) {
    return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  }
  const invitations: InvitationRow[] = [];
  for (const entry of call.body.invitations) {
    const invitation = readInvitation(entry);
    // One malformed row invalidates the list: a partial table would look
    // complete while hiding invitations.
    if (!invitation) {
      return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
    }
    invitations.push(invitation);
  }
  const total = readCount(call.body.total);
  if (total === null) {
    return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  }
  return { ok: true, invitations, total };
}
