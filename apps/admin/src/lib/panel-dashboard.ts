import { redirect } from "next/navigation";
import { invitationsRoute } from "@027apps/core/invitations/api.js";
import { modulesRoute } from "@027apps/core/modules/api.js";
import { computeHealth, type SettingsDeps } from "@027apps/core/settings/service.js";
import { userCategoriesRoute } from "@027apps/core/user-categories/api.js";
import { usersRoute } from "@027apps/core/users/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";
import { readInstanceState } from "@/lib/instance-state";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";
import { modulesRouteDeps } from "@/lib/modules-route-deps";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Dashboard reads business data through the Core API, in process: the page
 * never issues an HTTP request and never reads the database for API-owned data.
 * The session token travels as `Authorization: Bearer`, exactly as the proxy
 * would forward it, and the fixed origin keeps a forged `host`/`x-forwarded-host`
 * out of the call.
 *
 * Health and installation state are services, not business data: they are read
 * directly from the Core (like the panel layout reads settings). Calling the
 * public `/health` and `/instance` routes in process would share their per-IP
 * rate-limit bucket (`ip:unknown`) with real anonymous clients and could 429 the
 * panel after a handful of reloads.
 */
const INTERNAL_ORIGIN = "http://panel.internal";
/** The users route caps `limit` at 100; the dashboard asks for the widest page. */
const USERS_PAGE = "/api/v1/users?limit=100";

export interface DashboardHealth {
  status: "ok" | "degraded";
  reasons: string[];
}

export interface DashboardModule {
  key: string;
  name: string;
  state: string;
  isPublic: boolean;
}

export interface DashboardKpis {
  members: number;
  activeMembers: number;
  pendingInvitations: number;
  activeModules: number;
  totalModules: number;
  categories: number;
}

export type DashboardSuccess = {
  ok: true;
  health: DashboardHealth;
  setupIncomplete: boolean;
  kpis: DashboardKpis;
  modules: DashboardModule[];
};

export type DashboardFailure = {
  ok: false;
  requestId?: string;
  code?: string;
};

export type DashboardData = DashboardSuccess | DashboardFailure;

type RouteCall =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; requestId?: string; code?: string };

type ErrorFields = { requestId?: string; code?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Public envelope fields only: the API never returns internals here. */
function errorFields(value: unknown, headerRequestId?: string): ErrorFields {
  const error = isRecord(value) && isRecord(value.error) ? value.error : {};
  const code = readString(error.code);
  const requestId = readString(error.request_id) ?? headerRequestId;
  return {
    ...(code ? { code } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

async function callRoute(
  handler: (req: Request) => Promise<Response>,
  path: string,
  token: string,
  accepts: (status: number) => boolean = (status) => status >= 200 && status < 300,
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
    return { ok: false, ...(headerRequestId ? { requestId: headerRequestId } : {}) };
  }

  if (!accepts(res.status)) return { ok: false, ...errorFields(body, headerRequestId) };
  if (!isRecord(body)) {
    return { ok: false, ...(headerRequestId ? { requestId: headerRequestId } : {}) };
  }
  return { ok: true, body };
}

type HealthCall = { ok: true; health: DashboardHealth } | { ok: false };
type SetupCall = { ok: true; setupIncomplete: boolean } | { ok: false };

/** Health is a service call, so a failure has no route envelope (`code`/`request_id`). */
async function readHealth(settings: SettingsDeps): Promise<HealthCall> {
  try {
    const health = await computeHealth(settings);
    return {
      ok: true,
      health: { status: health.status, reasons: health.degradedReasons },
    };
  } catch {
    return { ok: false };
  }
}

/** `requires_setup` (no super_admin yet) and `setup_incomplete` share the same headline. */
async function readSetupIncomplete(): Promise<SetupCall> {
  try {
    const state = await readInstanceState();
    return { ok: true, setupIncomplete: !state.installed || state.setupIncomplete };
  } catch {
    return { ok: false };
  }
}

function readUsers(body: Record<string, unknown>): { members: number; activeMembers: number } | null {
  if (!Array.isArray(body.users)) return null;
  let activeMembers = 0;
  for (const entry of body.users) {
    if (!isRecord(entry)) return null;
    const deactivatedAt = entry.deactivated_at;
    if (deactivatedAt !== null && typeof deactivatedAt !== "string") return null;
    if (deactivatedAt === null) activeMembers += 1;
  }
  const total = readNumber(body.total) ?? body.users.length;
  return { members: total, activeMembers };
}

function readPendingInvitations(body: Record<string, unknown>): number | null {
  if (!Array.isArray(body.invitations)) return null;
  let pending = 0;
  for (const entry of body.invitations) {
    if (!isRecord(entry) || typeof entry.status !== "string") return null;
    if (entry.status === "pending") pending += 1;
  }
  return pending;
}

function readCategoryCount(body: Record<string, unknown>): number | null {
  if (!Array.isArray(body.categories)) return null;
  if (!body.categories.every((entry) => isRecord(entry))) return null;
  return body.categories.length;
}

function readModules(body: Record<string, unknown>): DashboardModule[] | null {
  if (!Array.isArray(body.modules)) return null;
  const modules: DashboardModule[] = [];
  for (const entry of body.modules) {
    if (!isRecord(entry)) return null;
    const key = readString(entry.key);
    const name = readString(entry.name);
    const state = readString(entry.state);
    if (!key || !name || !state || typeof entry.is_public !== "boolean") return null;
    modules.push({ key, name, state, isPublic: entry.is_public });
  }
  return modules;
}

/** Validates the four successful route bodies plus the two service reads together. */
function composeDashboard(input: {
  health: DashboardHealth;
  setupIncomplete: boolean;
  users: Record<string, unknown>;
  categories: Record<string, unknown>;
  invitations: Record<string, unknown>;
  modules: Record<string, unknown>;
}): DashboardData {
  const userCounts = readUsers(input.users);
  const categoryCount = readCategoryCount(input.categories);
  const pendingInvitations = readPendingInvitations(input.invitations);
  const moduleList = readModules(input.modules);

  if (
    !userCounts ||
    categoryCount === null ||
    pendingInvitations === null ||
    !moduleList
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    health: input.health,
    setupIncomplete: input.setupIncomplete,
    kpis: {
      members: userCounts.members,
      activeMembers: userCounts.activeMembers,
      pendingInvitations,
      activeModules: moduleList.filter((module) => module.state === "active").length,
      totalModules: moduleList.length,
      categories: categoryCount,
    },
    modules: moduleList,
  };
}

/**
 * Loads the dashboard from two Core services and the four authenticated Core
 * routes. Every read is independent, so they run together; a single failure
 * fails the dashboard with its public `code`/`request_id` instead of silently
 * painting zeros over a broken API.
 */
export async function loadPanelDashboard(): Promise<DashboardData> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) redirect("/login");

  const infra = await getInfra();
  const [invitationDeps, moduleDeps] = await Promise.all([
    invitationsRouteDeps(),
    modulesRouteDeps(),
  ]);

  const [health, setup, users, categories, invitations, modules] = await Promise.all([
    readHealth(infra.settingsDeps),
    readSetupIncomplete(),
    callRoute(
      usersRoute({
        door: infra.deps,
        auth: infra.auth,
        users: { db: infra.settingsDeps.db, withTransaction: withTransactionClient },
      }),
      USERS_PAGE,
      token,
    ),
    callRoute(
      userCategoriesRoute({
        door: infra.deps,
        auth: infra.auth,
        categories: { db: infra.settingsDeps.db, withTransaction: withTransactionClient },
      }),
      "/api/v1/user-categories",
      token,
    ),
    callRoute(invitationsRoute(invitationDeps), "/api/v1/invitations", token),
    callRoute(modulesRoute(moduleDeps), "/api/v1/modules", token),
  ]);

  // The first failure wins: showing a partial dashboard would hide a broken source.
  if (!health.ok) return health;
  if (!setup.ok) return setup;
  if (!users.ok) return users;
  if (!categories.ok) return categories;
  if (!invitations.ok) return invitations;
  if (!modules.ok) return modules;

  return composeDashboard({
    health: health.health,
    setupIncomplete: setup.setupIncomplete,
    users: users.body,
    categories: categories.body,
    invitations: invitations.body,
    modules: modules.body,
  });
}
