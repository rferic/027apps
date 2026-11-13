import { redirect } from "next/navigation";
import type { JsonValue } from "@027apps/core/api/types.js";
import {
  moduleGrantsRoute,
  moduleRoute,
  modulesRoute,
  moduleSettingsRoute,
  updateModuleSettingRoute,
} from "@027apps/core/modules/api.js";
import { PANEL_PAGE_SIZE } from "@/lib/panel-pagination";
import { modulesRouteDeps } from "@/lib/modules-route-deps";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INTERNAL_ORIGIN = "http://panel.internal";

/** Derived lifecycle state; the Core owns the transitions and the panel shows them. */
export type ModuleState = "installed" | "active" | "disabled";
export type ModuleMcpExposure = "none" | "read" | "read_write";

/** `ModuleView` from `packages/core/src/modules/service.ts`. */
export interface ModuleDetail {
  key: string;
  name: string;
  version: string;
  state: ModuleState;
  is_public: boolean;
  mcp_exposed: ModuleMcpExposure;
  manifest_digest: string;
  installed_at: string;
  updated_at: string;
}

/** `ModuleSettingView`; a secret setting never carries its value. */
export interface ModuleSetting {
  category_key: string;
  key: string;
  label: string;
  help: string | null;
  value: JsonValue | null;
  is_secret: boolean;
  configured: boolean;
  is_public: boolean;
  mcp_access: "none" | "read" | "write";
  sort_order: number;
  updated_at: string;
}

export interface ModuleGrantUser {
  id: string;
  display_name: string;
}

export interface ModuleGrantCategory {
  id: string;
  name: string;
}

/** Who currently holds the module; the API only returns it with `modules:manage`. */
export interface ModuleGrants {
  users: ModuleGrantUser[];
  categories: ModuleGrantCategory[];
}

export type ModuleFailure = {
  ok: false;
  code?: string;
  requestId?: string;
  /** Domain detail the panel needs to explain a conflict. */
  details?: { code?: string };
};

export type ModuleDetailResult = { ok: true; module: ModuleDetail } | ModuleFailure;
export type ModuleListResult = { ok: true; modules: ModuleDetail[]; total: number } | ModuleFailure;
export type ModuleSettingsResult = { ok: true; settings: ModuleSetting[] } | ModuleFailure;
export type ModuleGrantsResult = { ok: true; grants: ModuleGrants } | ModuleFailure;

type RouteSuccess = { ok: true; body: Record<string, unknown>; requestId?: string };
type RouteCall = RouteSuccess | ModuleFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** An opaque digest: present as a string even when an old install left it empty. */
function readDigest(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return readString(value);
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

/** A parsed field is usable only when its own type check produced a value. */
function present<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

function readState(value: unknown): ModuleState | undefined {
  return value === "installed" || value === "active" || value === "disabled" ? value : undefined;
}

function readExposure(value: unknown): ModuleMcpExposure | undefined {
  return value === "none" || value === "read" || value === "read_write" ? value : undefined;
}

function readMcpAccess(value: unknown): ModuleSetting["mcp_access"] | undefined {
  return value === "none" || value === "read" || value === "write" ? value : undefined;
}

function readJsonArray(value: unknown[]): JsonValue[] | undefined {
  const items: JsonValue[] = [];
  for (const entry of value) {
    const parsed = readJsonValue(entry);
    if (parsed === undefined) return undefined;
    items.push(parsed);
  }
  return items;
}

function readJsonObject(value: Record<string, unknown>): { [key: string]: JsonValue } | undefined {
  const object: { [key: string]: JsonValue } = {};
  for (const [key, entry] of Object.entries(value)) {
    const parsed = readJsonValue(entry);
    if (parsed === undefined) return undefined;
    object[key] = parsed;
  }
  return object;
}

/** Settings values are JSON; only JSON-shaped data survives the parse. */
function readJsonValue(value: unknown): JsonValue | null | undefined {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) return readJsonArray(value);
  if (isRecord(value)) return readJsonObject(value);
  return undefined;
}

type ModuleAudit = Pick<
  ModuleDetail,
  "is_public" | "manifest_digest" | "installed_at" | "updated_at"
>;

function readModuleAudit(value: Record<string, unknown>): ModuleAudit | null {
  const isPublic = readBoolean(value.is_public);
  const manifestDigest = readDigest(value.manifest_digest);
  const installedAt = readString(value.installed_at);
  const updatedAt = readString(value.updated_at);
  if (!present(isPublic) || !present(manifestDigest)) return null;
  if (!present(installedAt) || !present(updatedAt)) return null;
  return {
    is_public: isPublic,
    manifest_digest: manifestDigest,
    installed_at: installedAt,
    updated_at: updatedAt,
  };
}

function readModuleDetail(value: unknown): ModuleDetail | null {
  if (!isRecord(value)) return null;
  const key = readString(value.key);
  const name = readString(value.name);
  const version = readString(value.version);
  const state = readState(value.state);
  const mcpExposed = readExposure(value.mcp_exposed);
  if (!present(key) || !present(name) || !present(version)) return null;
  if (!present(state) || !present(mcpExposed)) return null;
  const audit = readModuleAudit(value);
  if (!audit) return null;
  return { key, name, version, state, mcp_exposed: mcpExposed, ...audit };
}

type ModuleSettingRest = Pick<
  ModuleSetting,
  "help" | "value" | "is_secret" | "configured" | "is_public"
>;

function readModuleSettingRest(value: Record<string, unknown>): ModuleSettingRest | null {
  const help = readNullableString(value.help);
  const settingValue = readJsonValue(value.value);
  const isSecret = readBoolean(value.is_secret);
  const configured = readBoolean(value.configured);
  const isPublic = readBoolean(value.is_public);
  if (help === undefined || settingValue === undefined) return null;
  if (!present(isSecret) || !present(configured) || !present(isPublic)) return null;
  return { help, value: settingValue, is_secret: isSecret, configured, is_public: isPublic };
}

function readModuleSetting(value: unknown): ModuleSetting | null {
  if (!isRecord(value)) return null;
  const categoryKey = readString(value.category_key);
  const key = readString(value.key);
  const label = readString(value.label);
  const mcpAccess = readMcpAccess(value.mcp_access);
  const sortOrder = readInteger(value.sort_order);
  const updatedAt = readString(value.updated_at);
  if (!present(categoryKey) || !present(key) || !present(label)) return null;
  if (!present(mcpAccess) || !present(sortOrder) || !present(updatedAt)) return null;
  const rest = readModuleSettingRest(value);
  if (!rest) return null;
  return {
    category_key: categoryKey,
    key,
    label,
    mcp_access: mcpAccess,
    sort_order: sortOrder,
    updated_at: updatedAt,
    ...rest,
  };
}

function readGrantUser(value: unknown): ModuleGrantUser | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const displayName = readString(value.display_name);
  if (!id || !displayName) return null;
  return { id, display_name: displayName };
}

function readGrantCategory(value: unknown): ModuleGrantCategory | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const name = readString(value.name);
  if (!id || !name) return null;
  return { id, name };
}

function readGrantUsers(value: unknown): ModuleGrantUser[] | null {
  if (!Array.isArray(value)) return null;
  const users: ModuleGrantUser[] = [];
  for (const entry of value) {
    const user = readGrantUser(entry);
    if (!user) return null;
    users.push(user);
  }
  return users;
}

function readGrantCategories(value: unknown): ModuleGrantCategory[] | null {
  if (!Array.isArray(value)) return null;
  const categories: ModuleGrantCategory[] = [];
  for (const entry of value) {
    const category = readGrantCategory(entry);
    if (!category) return null;
    categories.push(category);
  }
  return categories;
}

function readGrants(value: unknown): ModuleGrants | null {
  if (!isRecord(value)) return null;
  const users = readGrantUsers(value.users);
  const categories = readGrantCategories(value.categories);
  if (!users || !categories) return null;
  return { users, categories };
}

function errorFields(
  value: unknown,
  headerRequestId: string | undefined,
  status: number,
): ModuleFailure {
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
 * In-process call to the Core modules routes: a fixed internal origin (never
 * the client's `host`), the session as Bearer, and only the public envelope
 * fields on failure. The page never reads the database for module data.
 */
function routeRequest(path: string, token: string): Request {
  return new Request(`${INTERNAL_ORIGIN}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function callRoute(
  handler: (req: Request) => Promise<Response>,
  path: string,
  token: string,
): Promise<RouteCall> {
  let res: Response;
  try {
    res = await handler(routeRequest(path, token));
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

function pathFor(key: string, suffix = ""): string {
  return `/api/v1/modules/${encodeURIComponent(key)}${suffix}`;
}

export interface ModulesQuery {
  offset: number;
  limit?: number;
  /** Omitted or `all` keeps every lifecycle state. */
  state?: ModuleState | "all";
  /** Omitted or `all` keeps public and private modules alike. */
  public?: "all" | "yes" | "no";
}

/** Query for `GET /modules`: the page plus the filters the Core applies. */
function modulesQuery(input: ModulesQuery): string {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? PANEL_PAGE_SIZE));
  params.set("offset", String(Math.max(0, input.offset)));
  if (input.state) params.set("state", input.state);
  // `all` is the default: never widen the URL with a value that filters nothing.
  if (input.public && input.public !== "all") params.set("public", input.public);
  return params.toString();
}

/**
 * GET /api/v1/modules — one page of the installed catalogue. The install page
 * uses it to know which packages are already present (and therefore hidden).
 */
export async function loadModules(input: ModulesQuery): Promise<ModuleListResult> {
  const token = await sessionToken();
  const call = await callRoute(
    modulesRoute(await modulesRouteDeps()),
    `/api/v1/modules?${modulesQuery(input)}`,
    token,
  );
  if (!call.ok) return call;
  if (!Array.isArray(call.body.modules)) {
    return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  }

  const modules: ModuleDetail[] = [];
  for (const entry of call.body.modules) {
    const detail = readModuleDetail(entry);
    // One malformed row invalidates the list: a partial page would look
    // complete while hiding modules that are already installed.
    if (!detail) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
    modules.push(detail);
  }
  const total = readInteger(call.body.total);
  if (total === undefined) {
    return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  }
  return { ok: true, modules, total };
}

/** GET /api/v1/modules/{key} — the module row, never its settings. */
export async function loadModuleDetail(key: string): Promise<ModuleDetailResult> {
  const token = await sessionToken();
  const deps = await modulesRouteDeps();
  const handler = moduleRoute(deps);
  const call = await callRoute((req) => handler(req, key), pathFor(key), token);
  if (!call.ok) return call;

  const detail = readModuleDetail(call.body.module);
  if (!detail) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  return { ok: true, module: detail };
}

/** GET /api/v1/modules/{key}/settings — every setting, secrets without their value. */
/**
 * Writes one setting through the Core route, in process and with the panel
 * session. Range and type validation live in the Core; this only carries the
 * session and maps the envelope to a boolean plus the error code.
 */
export async function saveModuleSetting(
  moduleKey: string,
  settingKey: string,
  value: unknown,
): Promise<{ ok: true } | { ok: false; code?: string }> {
  const token = await sessionToken();
  const handler = updateModuleSettingRoute(await modulesRouteDeps());
  let res: Response;
  try {
    res = await handler(
      new Request(
        `${INTERNAL_ORIGIN}/api/v1/modules/${encodeURIComponent(moduleKey)}/settings`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ key: settingKey, value }),
        },
      ),
      moduleKey,
    );
  } catch {
    return { ok: false };
  }
  if (res.ok) return { ok: true };
  const body = (await res.json().catch(() => null)) as
    | { error?: { code?: string } }
    | null;
  return { ok: false, code: body?.error?.code };
}

export async function loadModuleSettings(key: string): Promise<ModuleSettingsResult> {
  const token = await sessionToken();
  const deps = await modulesRouteDeps();
  const handler = moduleSettingsRoute(deps);
  const call = await callRoute((req) => handler(req, key), pathFor(key, "/settings"), token);
  if (!call.ok) return call;
  if (!Array.isArray(call.body.settings)) {
    return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  }

  const settings: ModuleSetting[] = [];
  for (const entry of call.body.settings) {
    const setting = readModuleSetting(entry);
    // One malformed row invalidates the table: a partial list would look
    // complete while hiding a setting the module depends on.
    if (!setting) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
    settings.push(setting);
  }
  return { ok: true, settings };
}

/** GET /api/v1/modules/{key}/grants — who holds the module (scope `modules:manage`). */
export async function loadModuleGrants(key: string): Promise<ModuleGrantsResult> {
  const token = await sessionToken();
  const deps = await modulesRouteDeps();
  const handler = moduleGrantsRoute(deps);
  const call = await callRoute((req) => handler(req, key), pathFor(key, "/grants"), token);
  if (!call.ok) return call;

  const grants = readGrants(call.body);
  if (!grants) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  return { ok: true, grants };
}
