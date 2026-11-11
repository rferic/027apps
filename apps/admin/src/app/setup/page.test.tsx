import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getInfraMock = vi.fn();
const cookieValues = { current: {} as Record<string, string> };

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) =>
      cookieValues.current[name] ? { value: cookieValues.current[name] } : undefined,
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/api/door", () => ({ getInfra: () => getInfraMock() }));

const panelUser = { current: null as { id: string; email: string; displayName: string; role: string } | null };
vi.mock("@/lib/panel-guard", () => ({ loadPanelUser: async () => panelUser.current }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { email: "a@b.co" } } }),
      getSession: async () => ({ data: { session: null } }),
      refreshSession: async () => ({ data: { session: null } }),
    },
  }),
}));

vi.mock("./actions", () => ({
  backToSmtpAction: "/back-smtp",
  signOutAndRestartAction: "/sign-out",
}));

import SetupPage from "./page";
import { SMTP_COOKIE } from "./smtp-cookie";
import { LOCALE_COOKIE } from "@/lib/locale";

const TABLES = ["profiles", "settings", "settings_categories", "currencies", "rate_limit_counters"];

const PUBLIC_ROWS = [
  ["instance.name", "027Apps"],
  ["instance.public_url", "https://panel.test"],
  ["localization.default_locale", "es"],
  ["localization.timezone", "Europe/Madrid"],
  ["localization.default_currency", "EUR"],
  ["localization.enabled_locales", ["en", "es"]],
  ["notifications.push.provider", "none"],
].map(([key, value]) => ({
  key,
  value,
  value_encrypted: null,
  updated_by: null,
  updated_at: new Date("2026-11-03T00:00:00.000Z").toISOString(),
}));

const INCOMPLETE_ROWS = PUBLIC_ROWS.map((row) =>
  row.key === "instance.public_url" ? { ...row, value: null } : row,
);

/** Fake infra: dispatches on the query text the core helpers use. */
function infra(options: {
  superAdmin: boolean;
  complete: boolean;
  jwtExpiry?: number;
  defaultLocale?: string;
}) {
  const baseRows = options.complete ? PUBLIC_ROWS : INCOMPLETE_ROWS;
  const rows = baseRows.map((row) =>
    row.key === "localization.default_locale" && options.defaultLocale !== undefined
      ? { ...row, value: options.defaultLocale }
      : row,
  );
  return {
    settingsDeps: {
      db: {
        query: vi.fn(async (sql: string) => {
          if (sql.includes("from public.profiles")) {
            return { rows: options.superAdmin ? [{ "?column?": 1 }] : [] };
          }
          if (sql.includes("information_schema")) {
            return { rows: TABLES.map((table_name) => ({ table_name })) };
          }
          if (sql.includes("from public.currencies")) return { rows: [{ code: "EUR" }, { code: "USD" }] };
          if (sql.includes("security.jwt_expiry")) {
            return { rows: options.jwtExpiry === undefined ? [] : [{ value: options.jwtExpiry }] };
          }
          if (sql.includes("from public.settings")) return { rows };
          return { rows: [{}] };
        }),
      },
      encryption: { encrypt: async () => "v1:x:y:z", decrypt: async () => null },
      currencies: { isEnabled: async () => true },
    },
  };
}

beforeEach(() => {
  redirectMock.mockClear();
  getInfraMock.mockReset();
  cookieValues.current = {};
  panelUser.current = { id: "u1", email: "a@b.co", displayName: "Ana", role: "super_admin" };
  process.env.SETTINGS_ENCRYPTION_KEY = "unused-in-tests";
});

describe("SetupPage — wizard steps", () => {
  it("shows the environment checklist and the admin form while uninstalled", async () => {
    getInfraMock.mockResolvedValue(infra({ superAdmin: false, complete: false }));

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain("Environment");
    expect(html).toContain("Create super admin");
    expect(html).toContain("/brand/wordmark-light.svg");
    expect(html).toContain('aria-label="Language"');
  });

  it("renders steps 1–2 in Spanish with the shared header", async () => {
    cookieValues.current[LOCALE_COOKIE] = "es";
    getInfraMock.mockResolvedValue(infra({ superAdmin: false, complete: false }));

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain("Paso 1 · Entorno");
    expect(html).toContain("Crear super admin");
    expect(html).toContain("Todas las 5 tablas del núcleo existen.");
    expect(html).toContain("Clave de 32 bytes detectada.");
    expect(html).toContain("/brand/wordmark-light.svg");
    expect(html).toContain("h-12");
    expect(html).toContain('aria-label="Idioma"');
    expect(html).toContain("sm:flex-row");
    expect(html).not.toContain('class="absolute right-0 top-1/2 -translate-y-1/2"');
  });

  it("shows the SMTP step (3) once the admin exists and email is unconfirmed", async () => {
    getInfraMock.mockResolvedValue(infra({ superAdmin: true, complete: false }));

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain("Step 3 · Email");
    expect(html).toContain("Send test email");
    expect(html).toContain("/brand/wordmark-light.svg");
    expect(html).toContain('aria-label="Language"');
  });

  it("shows preferences (4–5) after the SMTP confirmation", async () => {
    cookieValues.current[SMTP_COOKIE] = "1";
    getInfraMock.mockResolvedValue(infra({ superAdmin: true, complete: false }));

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain("Step 4 · Preferences");
    expect(html).toContain("Finish installation");
    expect(html).toContain("USD");
    expect(html).toContain('action="/back-smtp"');
    expect(html).not.toContain('action="/sign-out"');
    expect(html).toContain("/brand/wordmark-light.svg");
    expect(html).toContain('aria-label="Language"');
  });

  it("proposes the wizard locale when the stored default is English", async () => {
    cookieValues.current[SMTP_COOKIE] = "1";
    cookieValues.current[LOCALE_COOKIE] = "es";
    getInfraMock.mockResolvedValue(
      infra({ superAdmin: true, complete: false, defaultLocale: "en" }),
    );

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain('<option value="es" selected="">es</option>');
    expect(html).toContain("Paso 4 · Preferencias");
  });

  it("proposes the wizard locale when the stored default is empty", async () => {
    cookieValues.current[SMTP_COOKIE] = "1";
    cookieValues.current[LOCALE_COOKIE] = "es";
    getInfraMock.mockResolvedValue(
      infra({ superAdmin: true, complete: false, defaultLocale: "" }),
    );

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain('<option value="es" selected="">es</option>');
  });

  it("preserves a non-seed default without resetting the current step", async () => {
    cookieValues.current[SMTP_COOKIE] = "1";
    cookieValues.current[LOCALE_COOKIE] = "es";
    getInfraMock.mockResolvedValue(
      infra({ superAdmin: true, complete: false, defaultLocale: "de" }),
    );

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain('<option value="de" selected="">de</option>');
    expect(html).toContain("Paso 4 · Preferencias");
  });

  it("blocks the wizard when the project issues tokens that are not 900 s", async () => {
    getInfraMock.mockResolvedValue(infra({ superAdmin: true, complete: false, jwtExpiry: 3600 }));

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain("Access tokens must last 900 s");
    expect(html).toContain("3600 s");
    expect(html).toContain('action="/sign-out"');
    expect(html).toContain("/brand/wordmark-light.svg");
    expect(html).toContain('aria-label="Language"');
  });

  it("sends a fully configured instance to the panel", async () => {
    getInfraMock.mockResolvedValue(infra({ superAdmin: true, complete: true }));

    await expect(SetupPage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/panel");
  });
});

describe("SetupPage — steps 3–5 are super_admin only", () => {
  it.each(["admin", "user"] as const)("redirects a %s session to /login", async (role) => {
    panelUser.current = { id: "u1", email: "a@b.co", displayName: "Ana", role };
    getInfraMock.mockResolvedValue(infra({ superAdmin: true, complete: false }));

    await expect(SetupPage()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects a request without a session to /login (as the proxy already did)", async () => {
    panelUser.current = null;
    getInfraMock.mockResolvedValue(infra({ superAdmin: true, complete: false }));

    await expect(SetupPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("lets a super_admin through to step 3", async () => {
    getInfraMock.mockResolvedValue(infra({ superAdmin: true, complete: false }));

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain("Step 3 · Email");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
