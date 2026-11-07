import { redirect } from "next/navigation";
import { modulesRoute } from "@027apps/core/modules/api.js";
import {
  userCategoriesRoute,
  userCategoryRoute,
  type UserCategoriesRouteDeps,
} from "@027apps/core/user-categories/api.js";
import { usersRoute, type UsersRouteDeps } from "@027apps/core/users/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";
import { modulesRouteDeps } from "@/lib/modules-route-deps";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INTERNAL_ORIGIN = "http://panel.internal";

/** The users route clamps `limit` to 100; one page is enough for a picker. */
export const MEMBER_CHOICES_LIMIT = 100;

export type CategoryMemberRole = string;

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  member_count: number;
  modules: string[];
}

export interface CategoryMemberRow {
  id: string;
  display_name: string;
  role: CategoryMemberRole;
}

export type CategoryDetail = CategoryRow & { members: CategoryMemberRow[] };

export type CategoryFailure = { ok: false; code?: string; requestId?: string };

export type CategoryList = { ok: true; categories: CategoryRow[] } | CategoryFailure;
export type CategoryDetailResult = { ok: true; category: CategoryDetail } | CategoryFailure;

export interface MemberChoice {
  id: string;
  displayName: string;
}

export type MemberChoices =
  | { ok: true; members: MemberChoice[]; total: number }
  | CategoryFailure;

export interface ModuleChoice {
  key: string;
  name: string;
}

export type ModuleChoices = { ok: true; modules: ModuleChoice[] } | CategoryFailure;

type RouteSuccess = { ok: true; body: Record<string, unknown>; requestId?: string };
type RouteCall = RouteSuccess | CategoryFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Display names are `text not null`; unlike ids they may legitimately be empty. */
function readText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  return readString(value);
}

function requestIdOf(call: RouteSuccess): { requestId?: string } {
  return call.requestId ? { requestId: call.requestId } : {};
}

/** Public envelope fields only: the API never returns internals here. */
function errorFields(
  value: unknown,
  headerRequestId: string | undefined,
  status: number,
): CategoryFailure {
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

async function categoriesRouteDeps(): Promise<UserCategoriesRouteDeps> {
  const { deps, auth, settingsDeps } = await getInfra();
  return {
    door: deps,
    auth,
    categories: { db: settingsDeps.db, withTransaction: withTransactionClient },
  };
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
 * In-process call to a Core route: the page never builds a URL from the
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

function readCategory(value: unknown): CategoryRow | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const name = readString(value.name);
  const slug = readString(value.slug);
  const createdAt = readString(value.created_at);
  const memberCount = readCount(value.member_count);
  const modules = readModules(value.modules);
  if (!id || !name || !slug || !createdAt) return null;
  if (memberCount === null || modules === null) return null;
  return { id, name, slug, created_at: createdAt, member_count: memberCount, modules };
}

function readCategoryMember(value: unknown): CategoryMemberRow | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const displayName = readText(value.display_name);
  const role = readString(value.role);
  if (!id || displayName === undefined || !role) return null;
  return { id, display_name: displayName, role };
}

function readCategoryDetail(value: unknown): CategoryDetail | null {
  const base = readCategory(value);
  if (!base || !isRecord(value) || !Array.isArray(value.members)) return null;
  const members: CategoryMemberRow[] = [];
  for (const entry of value.members) {
    const member = readCategoryMember(entry);
    // One malformed member invalidates the detail: a partial list would look
    // complete while hiding who belongs to the category.
    if (!member) return null;
    members.push(member);
  }
  return { ...base, members };
}

/** GET /api/v1/user-categories. The API returns the full list (no pagination). */
export async function loadCategories(): Promise<CategoryList> {
  const token = await sessionToken();
  const call = await callRoute(
    userCategoriesRoute(await categoriesRouteDeps()),
    "/api/v1/user-categories",
    token,
  );
  if (!call.ok) return call;

  if (!Array.isArray(call.body.categories)) return { ok: false, ...requestIdOf(call) };
  const categories: CategoryRow[] = [];
  for (const entry of call.body.categories) {
    const category = readCategory(entry);
    if (!category) return { ok: false, ...requestIdOf(call) };
    categories.push(category);
  }
  return { ok: true, categories };
}

/** GET /api/v1/user-categories/{id}. A 404 stays distinguishable for `notFound()`. */
export async function loadCategory(id: string): Promise<CategoryDetailResult> {
  const token = await sessionToken();
  const handler = userCategoryRoute(await categoriesRouteDeps());
  const call = await callRoute(
    (req) => handler(req, id),
    `/api/v1/user-categories/${encodeURIComponent(id)}`,
    token,
  );
  if (!call.ok) return call;

  const category = readCategoryDetail(call.body.category);
  if (!category) return { ok: false, ...requestIdOf(call) };
  return { ok: true, category };
}

interface MemberChoiceRow {
  id: string;
  displayName: string;
  deactivatedAt: string | null;
}

function readMemberChoice(value: unknown): MemberChoiceRow | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const displayName = readText(value.display_name);
  const deactivatedAt = readDate(value.deactivated_at);
  if (!id || displayName === undefined || deactivatedAt === undefined) return null;
  return { id, displayName, deactivatedAt };
}

/**
 * Active members that can join a category. The picker is capped at the API's
 * 100-row limit and reports the total so the page can say it is truncated.
 */
export async function loadMemberChoices(input: { q?: string }): Promise<MemberChoices> {
  const token = await sessionToken();
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  params.set("limit", String(MEMBER_CHOICES_LIMIT));
  params.set("offset", "0");

  const call = await callRoute(
    usersRoute(await usersRouteDeps()),
    `/api/v1/users?${params.toString()}`,
    token,
  );
  if (!call.ok) return call;
  if (!Array.isArray(call.body.users)) return { ok: false, ...requestIdOf(call) };

  const members: MemberChoice[] = [];
  for (const entry of call.body.users) {
    const member = readMemberChoice(entry);
    if (!member) return { ok: false, ...requestIdOf(call) };
    if (member.deactivatedAt === null) {
      members.push({ id: member.id, displayName: member.displayName });
    }
  }

  const total = readCount(call.body.total);
  if (total === null) return { ok: false, ...requestIdOf(call) };
  return { ok: true, members, total };
}

function readModuleChoice(value: unknown): ModuleChoice | null {
  if (!isRecord(value)) return null;
  const key = readString(value.key);
  const name = readString(value.name);
  if (!key || !name) return null;
  return { key, name };
}

/** GET /api/v1/modules, reduced to the keys and names the pickers show. */
export async function loadModuleChoices(): Promise<ModuleChoices> {
  const token = await sessionToken();
  const call = await callRoute(
    modulesRoute(await modulesRouteDeps()),
    "/api/v1/modules",
    token,
  );
  if (!call.ok) return call;
  if (!Array.isArray(call.body.modules)) return { ok: false, ...requestIdOf(call) };

  const modules: ModuleChoice[] = [];
  for (const entry of call.body.modules) {
    const choice = readModuleChoice(entry);
    if (!choice) return { ok: false, ...requestIdOf(call) };
    modules.push(choice);
  }
  return { ok: true, modules };
}
