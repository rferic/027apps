import { cache } from "react";
import { redirect } from "next/navigation";
import { currenciesRoute } from "@027apps/core/currencies/api.js";
import { readPublicSettings } from "@027apps/core/settings/service.js";
import { settingsCategoriesRoute } from "@027apps/core/settings/api.js";
import { SETTINGS_CATALOG, getSettingMeta } from "@027apps/core/settings/catalog.js";
import { getInfra } from "@/lib/api/door";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CurrencyList,
  CurrencyRow,
  RestrictedSetting,
  SettingRow,
  SettingsCategoryRow,
} from "@/lib/setting-types";

const INTERNAL_ORIGIN = "http://panel.internal";

/**
 * Public instance settings shared by the panel layout and its pages: `cache()`
 * collapses both reads into one per request instead of querying settings twice.
 */
export const loadPanelSettings = cache(async () => {
  const { settingsDeps } = await getInfra();
  return readPublicSettings(settingsDeps);
});

export type SettingsFailure = { ok: false; code?: string; requestId?: string };
export type SettingsCategories = { ok: true; categories: SettingsCategoryRow[] } | SettingsFailure;
export type Currencies = ({ ok: true } & CurrencyList) | SettingsFailure;

type RouteSuccess = { ok: true; body: Record<string, unknown>; requestId?: string };
type RouteCall = RouteSuccess | SettingsFailure;

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

function errorFields(
  value: unknown,
  headerRequestId: string | undefined,
  status: number,
): SettingsFailure {
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
 * In-process call to a Core route: never a URL derived from the client's
 * `host`/`x-forwarded-host` and never a network self-fetch.
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

interface SettingBase {
  key: string;
  category: string;
  label: string;
  help: string;
  type: SettingRow["type"];
  isSecret: boolean;
  isPublic: boolean;
  superAdminOnly: boolean;
  readOnly: boolean;
  sortOrder: number;
  updatedBy: string | null;
  updatedAt: string;
}

function readSettingTexts(value: Record<string, unknown>) {
  const key = readString(value.key);
  const category = readString(value.category);
  const label = readString(value.label);
  const help = typeof value.help === "string" ? value.help : undefined;
  if (!key || !category || !label || help === undefined) return null;
  return { key, category, label, help };
}

function readSettingFlags(value: Record<string, unknown>) {
  const isSecret = value.isSecret === true || value.isSecret === false ? value.isSecret : undefined;
  const isPublic = value.isPublic === true || value.isPublic === false ? value.isPublic : undefined;
  const sortOrder = readCount(value.sortOrder);
  const updatedBy = readNullableString(value.updatedBy);
  const updatedAt = readString(value.updatedAt);
  if (isSecret === undefined || isPublic === undefined || sortOrder === null) return null;
  if (updatedBy === undefined || !updatedAt) return null;
  return { isSecret, isPublic, sortOrder, updatedBy, updatedAt };
}

function readSettingBase(value: Record<string, unknown>): SettingBase | null {
  const texts = readSettingTexts(value);
  const flags = readSettingFlags(value);
  if (!texts || !flags) return null;

  const meta = getSettingMeta(texts.key);
  // The service refuses to render a key without catalog metadata; the panel
  // treats it the same way instead of guessing the input control.
  if (!meta) return null;

  return {
    ...texts,
    ...flags,
    type: meta.type,
    superAdminOnly: meta.superAdminOnly,
    readOnly: meta.readOnly,
  };
}

function readSetting(value: unknown): SettingRow | null {
  if (!isRecord(value)) return null;
  const base = readSettingBase(value);
  if (!base) return null;

  if (base.isSecret) {
    // A secret never carries `value`; a leaked plaintext invalidates the page.
    if (Object.prototype.hasOwnProperty.call(value, "value")) return null;
    if (value.configured !== true && value.configured !== false) return null;
    return { ...base, configured: value.configured };
  }

  if (!Object.prototype.hasOwnProperty.call(value, "value")) return null;
  return { ...base, value: value.value };
}

interface CategoryHeader {
  categoryKey: string;
  label: string;
  help: string;
  icon: string;
  sortOrder: number;
}

function readCategoryHeader(value: Record<string, unknown>): CategoryHeader | null {
  const categoryKey = readString(value.categoryKey);
  const label = readString(value.label);
  const help = typeof value.help === "string" ? value.help : undefined;
  const icon = readString(value.icon);
  const sortOrder = readCount(value.sortOrder);
  if (!categoryKey || !label || help === undefined || !icon || sortOrder === null) return null;
  return { categoryKey, label, help, icon, sortOrder };
}

function readCategory(value: unknown): SettingsCategoryRow | null {
  if (!isRecord(value)) return null;
  const header = readCategoryHeader(value);
  if (!header) return null;
  if (!Array.isArray(value.settings)) return null;

  const settings: SettingRow[] = [];
  for (const entry of value.settings) {
    const setting = readSetting(entry);
    if (!setting) return null;
    settings.push(setting);
  }
  return { ...header, settings };
}

/** GET /api/v1/settings-categories, with catalog type/flags joined per row. */
export async function loadSettingsCategories(): Promise<SettingsCategories> {
  const token = await sessionToken();
  const { deps, auth, settingsDeps } = await getInfra();
  const call = await callRoute(
    settingsCategoriesRoute({ door: deps, auth, settings: settingsDeps }),
    "/api/v1/settings-categories",
    token,
  );
  if (!call.ok) return call;
  if (!Array.isArray(call.body.categories)) {
    return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  }

  const categories: SettingsCategoryRow[] = [];
  for (const entry of call.body.categories) {
    const category = readCategory(entry);
    if (!category) {
      return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
    }
    categories.push(category);
  }
  return { ok: true, categories };
}

function readCurrency(value: unknown): CurrencyRow | null {
  if (!isRecord(value)) return null;
  const code = readString(value.code);
  const enabled = value.enabled === true || value.enabled === false ? value.enabled : undefined;
  const isDefault = value.isDefault === true || value.isDefault === false ? value.isDefault : undefined;
  if (!code || !/^[A-Z]{3}$/.test(code)) return null;
  if (enabled === undefined || isDefault === undefined) return null;
  return { code, enabled, isDefault };
}

/** GET /api/v1/currencies — codes, enabled flag and the default marker. */
export async function loadCurrencies(): Promise<Currencies> {
  const token = await sessionToken();
  const { deps, auth, currenciesDeps } = await getInfra();
  const call = await callRoute(
    currenciesRoute({ door: deps, auth, currencies: currenciesDeps }),
    "/api/v1/currencies",
    token,
  );
  if (!call.ok) return call;

  const defaultCode = readNullableString(call.body.default);
  if (defaultCode === undefined || !Array.isArray(call.body.currencies)) {
    return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
  }

  const currencies: CurrencyRow[] = [];
  for (const entry of call.body.currencies) {
    const row = readCurrency(entry);
    if (!row) return { ok: false, ...(call.requestId ? { requestId: call.requestId } : {}) };
    currencies.push(row);
  }
  return { ok: true, default: defaultCode, currencies };
}

/**
 * Server-side composition of what a role may read. The API omits
 * `superAdminOnly` rows below super_admin, so the page renders them as
 * placeholders with this catalog text instead of an input disabled by CSS.
 */
export function settingsVisibility(role: "admin" | "super_admin"): {
  restricted: RestrictedSetting[];
  readOnlyKeys: string[];
} {
  return {
    restricted:
      role === "super_admin"
        ? []
        : SETTINGS_CATALOG.filter((meta) => meta.superAdminOnly).map((meta) => ({
            key: meta.key,
            category: meta.category,
            label: meta.label,
            help: meta.help,
            readOnly: meta.readOnly,
          })),
    readOnlyKeys: SETTINGS_CATALOG.filter((meta) => meta.readOnly).map((meta) => meta.key),
  };
}
