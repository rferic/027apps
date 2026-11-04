import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getInfraMock = vi.fn();
const cookieValue = { current: undefined as string | undefined };

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookieValue.current ? { value: cookieValue.current } : undefined),
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/api/door", () => ({ getInfra: () => getInfraMock() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { email: "a@b.co" } } }),
      getSession: async () => ({ data: { session: null } }),
      refreshSession: async () => ({ data: { session: null } }),
    },
  }),
}));

import SetupPage from "./page";

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
function infra(options: { superAdmin: boolean; complete: boolean; jwtExpiry?: number }) {
  const rows = options.complete ? PUBLIC_ROWS : INCOMPLETE_ROWS;
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
  cookieValue.current = undefined;
  process.env.SETTINGS_ENCRYPTION_KEY = "unused-in-tests";
});

describe("SetupPage — wizard steps", () => {
  it("shows the environment checklist and the admin form while uninstalled", async () => {
    getInfraMock.mockResolvedValue(infra({ superAdmin: false, complete: false }));

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain("Environment");
    expect(html).toContain("Create super admin");
  });

  it("shows the SMTP step (3) once the admin exists and email is unconfirmed", async () => {
    getInfraMock.mockResolvedValue(infra({ superAdmin: true, complete: false }));

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain("Step 3 · Email");
    expect(html).toContain("Send test email");
  });

  it("shows preferences (4–5) after the SMTP confirmation", async () => {
    cookieValue.current = "1";
    getInfraMock.mockResolvedValue(infra({ superAdmin: true, complete: false }));

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain("Step 4 · Preferences");
    expect(html).toContain("Finish installation");
    expect(html).toContain("USD");
  });

  it("blocks the wizard when the project issues tokens that are not 900 s", async () => {
    getInfraMock.mockResolvedValue(infra({ superAdmin: true, complete: false, jwtExpiry: 3600 }));

    const html = renderToStaticMarkup(await SetupPage());

    expect(html).toContain("Access tokens must last 900 s");
    expect(html).toContain("3600 s");
  });

  it("sends a fully configured instance to the panel", async () => {
    getInfraMock.mockResolvedValue(infra({ superAdmin: true, complete: true }));

    await expect(SetupPage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
