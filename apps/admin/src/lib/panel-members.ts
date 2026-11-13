import { redirect } from "next/navigation";
import type { LogEntry } from "@027apps/core/api/types.js";
import { userRoute, usersRoute, type UsersRouteDeps } from "@027apps/core/users/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Page size used by `/members`; the API clamps `limit` to 100. */
export const MEMBERS_PAGE_SIZE = 20;

const INTERNAL_ORIGIN = "http://panel.internal";

export type MemberRole = "super_admin" | "admin" | "user";
export type MemberState = "active" | "deactivated";
/** `all` is sent explicitly; the list defaults to active when the key is absent. */
export type MemberStateFilter = MemberState | "all";

/** A category the member belongs to; the API orders them by name. */
export type MemberCategory = { id: string; name: string };

/** `UserView` plus the auth email the Core API deliberately does not expose. */
export interface MemberRow {
  id: string;
  display_name: string;
  /** `null` when the account has no email on file. */
  email: string | null;
  /** The `auth.users` lookup failed; distinct from an account without email. */
  emailUnavailable: boolean;
  locale: string;
  timezone: string;
  role: MemberRole;
  created_at: string;
  deactivated_at: string | null;
  categories: MemberCategory[];
}

export type MemberDetail = MemberRow;

export type MemberListSuccess = {
  ok: true;
  users: MemberRow[];
  total: number;
  activeTotal: number;
};

export type MemberDetailSuccess = { ok: true; member: MemberDetail };

export type MemberFailure = { ok: false; code?: string; requestId?: string };

export type MemberList = MemberListSuccess | MemberFailure;
export type MemberDetailResult = MemberDetailSuccess | MemberFailure;

type UserFields = Omit<MemberRow, "email" | "emailUnavailable">;

type RouteSuccess = { ok: true; body: Record<string, unknown>; requestId?: string };
type RouteCall = RouteSuccess | MemberFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readRole(value: unknown): MemberRole | null {
  return value === "super_admin" || value === "admin" || value === "user" ? value : null;
}

/** Public envelope fields only: the API never returns internals here. */
function errorFields(value: unknown, headerRequestId: string | undefined, status: number): MemberFailure {
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

async function usersRouteDeps(): Promise<UsersRouteDeps> {
  const { deps, auth, settingsDeps } = await getInfra();
  return {
    door: deps,
    auth,
    users: { db: settingsDeps.db, withTransaction: withTransactionClient },
  };
}

/**
 * In-process call to a Core users route: the page never builds a URL from the
 * client's `host`/`x-forwarded-host` (a forged header could redirect the
 * session) and never leaves the process. The token travels as a Bearer header.
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

/** `null` is a valid value (active profile); `undefined` means malformed. */
function readDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  return readString(value);
}

/** Categories are ordered by the API; a malformed entry invalidates the row. */
function readCategories(value: unknown): MemberCategory[] | null {
  if (!Array.isArray(value)) return null;
  const categories: MemberCategory[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const id = readString(entry.id);
    const name = readString(entry.name);
    if (!id || !name) return null;
    categories.push({ id, name });
  }
  return categories;
}

function readUser(value: unknown): UserFields | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const displayName = readText(value.display_name);
  const role = readRole(value.role);
  const locale = readString(value.locale);
  const timezone = readString(value.timezone);
  const createdAt = readString(value.created_at);
  const deactivatedAt = readDate(value.deactivated_at);
  const categories = readCategories(value.categories);
  if (!id) return null;
  if (displayName === undefined) return null;
  if (!role) return null;
  if (!locale) return null;
  if (!timezone) return null;
  if (!createdAt) return null;
  if (deactivatedAt === undefined) return null;
  if (!categories) return null;
  return {
    id,
    display_name: displayName,
    locale,
    timezone,
    role,
    created_at: createdAt,
    deactivated_at: deactivatedAt,
    categories,
  };
}

type EmailLookup = { ok: true; emails: Map<string, string> } | { ok: false };

/**
 * `UserView` omits the auth email and there is no Core route that returns it.
 * The panel reads it from `auth.users` with the service pool (the same source
 * the invitation adapter uses): one query per page, never from client headers.
 * A failure keeps the list visible and is distinguished from an account that
 * simply has no email.
 *
 * Moving the email to a Core resource is tracked as debt (ADR 0004 §7).
 */
async function emailsFor(ids: readonly string[]): Promise<EmailLookup> {
  if (ids.length === 0) return { ok: true, emails: new Map() };
  let logger: ((entry: LogEntry) => void) | undefined;
  try {
    const infra = await getInfra();
    logger = infra.deps.logger;
    const { rows } = await infra.settingsDeps.db.query(
      "select id, email from auth.users where id = any($1::uuid[])",
      [ids],
    );
    const emails = new Map<string, string>();
    for (const row of rows) {
      const id = readString(row.id);
      const email = readString(row.email);
      if (id && email) emails.set(id, email);
    }
    return { ok: true, emails };
  } catch {
    // Correlation only: the line never carries ids or addresses.
    logger?.({
      level: "warn",
      requestId: "panel-members",
      route: "/panel/members",
      code: "email_lookup_failed",
      message: "auth.users email lookup failed",
    });
    return { ok: false };
  }
}

function withEmail(user: UserFields, lookup: EmailLookup): MemberRow {
  if (!lookup.ok) return { ...user, email: null, emailUnavailable: true };
  return { ...user, email: lookup.emails.get(user.id) ?? null, emailUnavailable: false };
}

/** GET /api/v1/users with `q`, `role`, `state`, `category` and an offset; the page size is fixed here. */
export async function loadMembers(input: {
  q?: string;
  role?: MemberRole;
  state?: MemberStateFilter;
  category?: string;
  offset: number;
}): Promise<MemberList> {
  const token = await sessionToken();
  const params = new URLSearchParams();
  const optional: Array<[string, string | undefined]> = [
    ["q", input.q],
    ["role", input.role],
    ["state", input.state],
    ["category", input.category],
  ];
  for (const [key, value] of optional) {
    if (value) params.set(key, value);
  }
  params.set("limit", String(MEMBERS_PAGE_SIZE));
  params.set("offset", String(Math.max(0, input.offset)));

  const call = await callRoute(
    usersRoute(await usersRouteDeps()),
    `/api/v1/users?${params.toString()}`,
    token,
  );
  if (!call.ok) return call;

  if (!Array.isArray(call.body.users)) return { ok: false, ...requestIdOf(call) };
  const users: UserFields[] = [];
  for (const entry of call.body.users) {
    const user = readUser(entry);
    if (!user) return { ok: false, ...requestIdOf(call) };
    users.push(user);
  }

  const total = readCount(call.body.total);
  const activeTotal = readCount(call.body.active_total);
  if (total === null || activeTotal === null) return { ok: false, ...requestIdOf(call) };

  const emails = await emailsFor(users.map((user) => user.id));
  return { ok: true, users: users.map((user) => withEmail(user, emails)), total, activeTotal };
}

/** GET /api/v1/users/{id}. A 404 stays distinguishable for `notFound()`. */
export async function loadMember(id: string): Promise<MemberDetailResult> {
  const token = await sessionToken();
  const handler = userRoute(await usersRouteDeps());
  const call = await callRoute(
    (req) => handler(req, id),
    `/api/v1/users/${encodeURIComponent(id)}`,
    token,
  );
  if (!call.ok) return call;

  const user = readUser(call.body.user);
  if (!user) return { ok: false, ...requestIdOf(call) };

  const emails = await emailsFor([user.id]);
  return { ok: true, member: withEmail(user, emails) };
}

function requestIdOf(call: RouteSuccess): { requestId?: string } {
  return call.requestId ? { requestId: call.requestId } : {};
}
