import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const getInfraMock = vi.fn();
const categoriesHandlerMock = vi.fn();
const currenciesHandlerMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getSession: () => getSessionMock() },
  }),
}));

vi.mock("@/lib/api/door", () => ({
  getInfra: () => getInfraMock(),
}));

vi.mock("@027apps/core/settings/api.js", () => ({
  settingsCategoriesRoute: () => categoriesHandlerMock,
}));

vi.mock("@027apps/core/currencies/api.js", () => ({
  currenciesRoute: () => currenciesHandlerMock,
}));

import {
  loadCurrencies,
  loadSettingsCategories,
  settingsVisibility,
} from "./panel-settings";

const SETTING = {
  key: "instance.name",
  category: "instance",
  label: "Instance name",
  help: "Public name of this 027Apps instance.",
  isSecret: false,
  isPublic: true,
  mcpAccess: "read",
  sortOrder: 10,
  updatedBy: null,
  updatedAt: "2026-11-01T10:00:00.000Z",
  value: "027Apps",
};

const SECRET = {
  key: "notifications.push.fcm_service_account",
  category: "notifications",
  label: "FCM service account",
  help: "Service account JSON used to sign pushes (secret).",
  isSecret: true,
  isPublic: false,
  mcpAccess: "none",
  sortOrder: 60,
  updatedBy: null,
  updatedAt: "2026-11-01T10:00:00.000Z",
  configured: true,
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  getInfraMock.mockReset();
  getInfraMock.mockResolvedValue({
    deps: {},
    auth: {},
    settingsDeps: {},
    currenciesDeps: {},
  });
  categoriesHandlerMock.mockReset();
  currenciesHandlerMock.mockReset();
});

describe("loadSettingsCategories", () => {
  it("joins the catalog type and flags onto each API view", async () => {
    categoriesHandlerMock.mockResolvedValue(
      json({
        categories: [
          {
            categoryKey: "instance",
            label: "Instance",
            help: "Instance identity and public links.",
            icon: "server",
            sortOrder: 10,
            settings: [SETTING],
          },
        ],
      }),
    );

    const result = await loadSettingsCategories();

    expect(result.ok).toBe(true);
    expect(result.ok && result.categories[0]?.settings[0]).toMatchObject({
      key: "instance.name",
      type: "string",
      superAdminOnly: false,
      readOnly: false,
      value: "027Apps",
    });
    const request = categoriesHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/settings-categories");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
  });

  it("keeps a secret masked: configured is a boolean and no value is carried", async () => {
    categoriesHandlerMock.mockResolvedValue(
      json({
        categories: [
          {
            categoryKey: "notifications",
            label: "Notifications",
            help: "",
            icon: "bell",
            sortOrder: 40,
            settings: [SECRET],
          },
        ],
      }),
    );

    const result = await loadSettingsCategories();

    expect(result.ok && result.categories[0]?.settings[0]).toEqual({
      key: SECRET.key,
      category: "notifications",
      label: SECRET.label,
      help: SECRET.help,
      type: "json",
      isSecret: true,
      isPublic: false,
      superAdminOnly: false,
      readOnly: false,
      sortOrder: 60,
      updatedBy: null,
      updatedAt: "2026-11-01T10:00:00.000Z",
      configured: true,
    });
  });

  it("returns the public code and request id on a 500", async () => {
    categoriesHandlerMock.mockResolvedValue(
      json({ error: { code: "internal", request_id: "req-500" } }, 500),
    );

    await expect(loadSettingsCategories()).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("infers not_found from a bare 404", async () => {
    categoriesHandlerMock.mockResolvedValue(new Response("", { status: 404 }));

    await expect(loadSettingsCategories()).resolves.toEqual({ ok: false, code: "not_found" });
  });

  it("rejects a malformed category instead of rendering a partial page", async () => {
    categoriesHandlerMock.mockResolvedValue(
      json({ categories: [{ categoryKey: "instance", settings: [SETTING] }] }),
    );

    await expect(loadSettingsCategories()).resolves.toEqual({ ok: false });
  });

  it("rejects a secret that leaks a plaintext value", async () => {
    categoriesHandlerMock.mockResolvedValue(
      json({
        categories: [
          {
            categoryKey: "notifications",
            label: "Notifications",
            help: "",
            icon: "bell",
            sortOrder: 40,
            settings: [{ ...SECRET, value: "leaked" }],
          },
        ],
      }),
    );

    await expect(loadSettingsCategories()).resolves.toEqual({ ok: false });
  });

  it("redirects to login without a session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(loadSettingsCategories()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(categoriesHandlerMock).not.toHaveBeenCalled();
  });
});

describe("loadCurrencies", () => {
  it("returns the default code and the currency flags", async () => {
    currenciesHandlerMock.mockResolvedValue(
      json({
        default: "EUR",
        currencies: [
          { code: "EUR", enabled: true, isDefault: true },
          { code: "USD", enabled: false, isDefault: false },
        ],
      }),
    );

    await expect(loadCurrencies()).resolves.toEqual({
      ok: true,
      default: "EUR",
      currencies: [
        { code: "EUR", enabled: true, isDefault: true },
        { code: "USD", enabled: false, isDefault: false },
      ],
    });
    const request = currenciesHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/currencies");
  });

  it("allows a null default (not configured) as a real state", async () => {
    currenciesHandlerMock.mockResolvedValue(
      json({ default: null, currencies: [{ code: "EUR", enabled: true, isDefault: false }] }),
    );

    await expect(loadCurrencies()).resolves.toMatchObject({ ok: true, default: null });
  });

  it("keeps the request id of a 500", async () => {
    currenciesHandlerMock.mockResolvedValue(
      json({ error: { code: "internal", request_id: "req-500" } }, 500),
    );

    await expect(loadCurrencies()).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("rejects an invalid currency row", async () => {
    currenciesHandlerMock.mockResolvedValue(
      json({ default: "EUR", currencies: [{ code: "eur", enabled: "yes", isDefault: true }] }),
    );

    await expect(loadCurrencies()).resolves.toEqual({ ok: false });
  });
});

describe("settingsVisibility", () => {
  it("lists the super-admin-only keys an admin cannot read", () => {
    const visibility = settingsVisibility("admin");

    expect(visibility.restricted.map((setting) => setting.key)).toEqual([
      "instance.public_url",
      "security.jwt_expiry",
      "security.cors_allowlist",
    ]);
    expect(visibility.readOnlyKeys).toEqual(["security.jwt_expiry"]);
  });

  it("shows everything to a super_admin", () => {
    expect(settingsVisibility("super_admin")).toEqual({
      restricted: [],
      readOnlyKeys: ["security.jwt_expiry"],
    });
  });
});
