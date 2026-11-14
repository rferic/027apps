import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Opaque deps: the route itself is mocked, only its wiring is asserted. */
const DEPS = { door: {}, auth: {}, modules: {} };

const requirePanelMock = vi.fn();
/** The handler returned by the mocked `modulesRoute(deps)`. */
const routeHandlerMock = vi.fn();
const modulesRouteMock = vi.fn((deps: unknown) => {
  void deps; // asserted via `toHaveBeenCalledWith`; the route itself is mocked.
  return routeHandlerMock;
});
const modulesRouteDepsMock = vi.fn(async () => DEPS);
const getSessionMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [{ name: "session", value: "token-123" }],
    get: () => undefined,
  }),
}));

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/panel-i18n", () => ({
  loadPanelMessages: async () => ({}),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

vi.mock("@/lib/modules-route-deps", () => ({
  modulesRouteDeps: () => modulesRouteDepsMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getSession: () => getSessionMock() },
  }),
}));

vi.mock("@027apps/core/modules/api.js", () => ({
  modulesRoute: (deps: unknown) => modulesRouteMock(deps),
}));

import ModulesPage, { instant } from "./page";

const MODULES = [
  {
    key: "expenses",
    name: "Expenses",
    version: "1.2.0",
    state: "active",
    is_public: true,
  },
  {
    key: "notes",
    name: "Notes",
    version: "0.4.1",
    state: "disabled",
    is_public: false,
  },
];

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
  routeHandlerMock.mockReset();
  modulesRouteMock.mockClear();
  modulesRouteDepsMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  redirectMock.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ModulesPage", () => {
  it("opts the segment out of the static shell (the layout opt-out is not inherited)", () => {
    expect(instant).toBe(false);
  });

  it("lists the modules returned by the core route in process", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: MODULES, total: 2 }, 200, { "x-request-id": "req-ok" }));

    const html = renderToStaticMarkup(
      await ModulesPage({ searchParams: Promise.resolve({ state: "all" }) }),
    );

    expect(html).toContain("expenses");
    expect(html).toContain("Expenses");
    expect(html).toContain("notes");
    expect(html).toContain("Notes");
    expect(html).toContain("<table");
    expect(html).toContain('class="flex flex-col gap-4 rounded-card border border-border bg-surface p-4"');
    expect(html).toContain("<caption");

    // The route is called with the shared deps and a synthetic in-process request.
    expect(modulesRouteMock).toHaveBeenCalledTimes(1);
    expect(modulesRouteMock).toHaveBeenCalledWith(DEPS);
    const request = routeHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/modules?limit=20&offset=0&state=all");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    // No network call and no client-controlled origin involved.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("links every row and every card to the module detail", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: MODULES, total: 2 }));

    const html = renderToStaticMarkup(
      await ModulesPage({ searchParams: Promise.resolve({ state: "all" }) }),
    );

    expect(html).toContain('href="/panel/modules/expenses"');
    expect(html).toContain('href="/panel/modules/notes"');
    // Row, card header and the card's "Settings" action all open the ficha.
    expect(html.match(/href="\/panel\/modules\/expenses"/g)).toHaveLength(3);
    expect(html).toContain("cursor-pointer");
    expect(html).toContain("border-spacing-0");
  });

  it("shows the empty state instead of a table when there are no modules", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: [], total: 0 }));

    const html = renderToStaticMarkup(await ModulesPage());

    expect(html).toContain("No modules are installed yet.");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("expenses");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers the install page as the primary action, visible on mobile", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: [], total: 0 }));

    const html = renderToStaticMarkup(await ModulesPage());

    expect(html).toContain('href="/panel/modules/install"');
    expect(html).toContain("Install module");
    expect(html).toContain("bg-primary");
    expect(html).not.toContain('href="/panel/modules/install" class="hidden');
  });

  it("shows the error state with the translated code, the request id and a retry link", async () => {
    routeHandlerMock.mockResolvedValue(
      json(
        { error: { code: "internal", message: "Internal server error", request_id: "req-500" } },
        500,
        { "x-request-id": "req-500" },
      ),
    );

    const html = renderToStaticMarkup(await ModulesPage());

    expect(html).toContain("load the module catalogue");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).not.toContain(">internal<");
    expect(html).toContain("req-500");
    expect(html).toContain('href="/panel/modules"');
    expect(html).toContain("Try again");
    expect(html).not.toContain("<table");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps an unknown error code visible instead of hiding it", async () => {
    routeHandlerMock.mockResolvedValue(json({ error: { code: "teapot" } }, 418));

    const html = renderToStaticMarkup(await ModulesPage());

    expect(html).toContain("teapot");
  });

  it("treats a row that fails validation as an error, not as an empty catalogue", async () => {
    routeHandlerMock.mockResolvedValue(
      json({ modules: [MODULES[0], { key: "broken", name: "Broken" }], total: 2 }),
    );

    const html = renderToStaticMarkup(await ModulesPage());

    expect(html).toContain("load the module catalogue");
    expect(html).not.toContain("No modules are installed yet.");
    expect(html).not.toContain("expenses");
  });

  it("renders the generic 403 with an exit when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({ denied: true });

    const html = renderToStaticMarkup(await ModulesPage());

    expect(html).toContain("You do not have access to this page.");
    expect(html).toContain("Log out");
    expect(html).not.toContain("expenses");
    expect(modulesRouteMock).not.toHaveBeenCalled();
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it("never derives the API call from client headers nor uses fetch", async () => {
    vi.stubGlobal("fetch", undefined);
    routeHandlerMock.mockResolvedValue(json({ modules: [], total: 0 }));

    const html = renderToStaticMarkup(await ModulesPage());

    expect(html).toContain("No modules are installed yet.");
    const request = routeHandlerMock.mock.calls[0]?.[0] as Request;
    // Fixed internal origin: a forged x-forwarded-host/host cannot redirect it.
    expect(request.url).toBe("http://panel.internal/api/v1/modules?limit=20&offset=0&state=all");
    expect(request.headers.get("x-forwarded-host")).toBeNull();
    expect(request.headers.get("host")).toBeNull();
    // The session token travels in the header, never as a forwarded cookie.
    expect(request.headers.get("cookie")).toBeNull();
    expect(globalThis.fetch).toBeUndefined();
  });

  it("redirects to the login page when the session has no access token", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(ModulesPage()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(modulesRouteMock).not.toHaveBeenCalled();
  });

  it("paginates with a fixed page size and keeps the filters in the links", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: [MODULES[0]], total: 45 }));

    const html = renderToStaticMarkup(
      await ModulesPage({
        searchParams: Promise.resolve({ page: "2", state: "active", public: "yes" }),
      }),
    );

    const request = routeHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(
      "http://panel.internal/api/v1/modules?limit=20&offset=20&state=active&public=yes",
    );
    expect(html).toContain("Page 2 of 3");
    expect(html).toContain('href="/panel/modules?state=active&amp;public=yes"');
    expect(html).toContain('href="/panel/modules?state=active&amp;public=yes&amp;page=3"');
  });

  it("keeps the pagination visible and disabled on a single page", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: MODULES, total: 2 }));

    const html = renderToStaticMarkup(await ModulesPage());

    expect(html).toContain("Page 1 of 1");
    expect(html).toContain('aria-disabled="true"');
  });

  it("sends state and visibility to the core route instead of filtering the page", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: [MODULES[1]], total: 1 }));

    const html = renderToStaticMarkup(
      await ModulesPage({ searchParams: Promise.resolve({ state: "disabled", public: "no" }) }),
    );

    const request = routeHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(
      "http://panel.internal/api/v1/modules?limit=20&offset=0&state=disabled&public=no",
    );
    expect(html).toContain("Notes");
    expect(html).not.toContain("Expenses");
    expect(routeHandlerMock).toHaveBeenCalledTimes(1);
  });

  it("never filters a server page in the client, even when a row would not match", async () => {
    // The Core decides; a page can legitimately mix rows of the filter's state
    // (the filter is applied there). Filtering again here would hide rows.
    routeHandlerMock.mockResolvedValue(json({ modules: MODULES, total: 2 }));

    const html = renderToStaticMarkup(
      await ModulesPage({ searchParams: Promise.resolve({ state: "active" }) }),
    );

    expect(html).toContain("Expenses");
    expect(html).toContain("Notes");
  });

  it("redirects only when the requested page is past the last one", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: [], total: 40 }));

    await expect(
      ModulesPage({ searchParams: Promise.resolve({ page: "3", state: "active" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/panel/modules?state=active&page=2");
  });
});

describe("ModulesPage default filter", () => {
  it("starts on All without a state parameter: installed, active and disabled modules alike", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: MODULES, total: 45 }));

    const html = renderToStaticMarkup(
      await ModulesPage({ searchParams: Promise.resolve({ page: "2" }) }),
    );

    expect(html).toContain("Expenses");
    expect(html).toContain("Notes");
    expect(html).toContain('<option value="all" selected=""');
    expect(html).not.toContain('<option value="active" selected=""');
    expect(html).toContain('href="/panel/modules"');
    expect(html).toContain('href="/panel/modules?page=3"');
    const request = routeHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(
      "http://panel.internal/api/v1/modules?limit=20&offset=20&state=all",
    );
  });

  it("lists All first in the state select", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: MODULES, total: 2 }));

    const html = renderToStaticMarkup(await ModulesPage());

    const values = [...html.matchAll(/<option value="(installed|active|disabled|all)"/g)].map(
      (match) => match[1],
    );
    expect(values).toEqual(["all", "installed", "active", "disabled"]);
  });

  it("sends All as an explicit state=all but never keeps it in the canonical URL", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: MODULES, total: 45 }));

    const html = renderToStaticMarkup(
      await ModulesPage({ searchParams: Promise.resolve({ state: "all", page: "2" }) }),
    );

    expect(html).toContain("Expenses");
    expect(html).toContain("Notes");
    expect(html).toContain('<option value="all" selected=""');
    expect(html).toContain('href="/panel/modules?page=3"');
    expect(html).not.toContain("state=all");
  });

  it("keeps state=active in the URL and in the pagination", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: [MODULES[0]], total: 45 }));

    const html = renderToStaticMarkup(
      await ModulesPage({ searchParams: Promise.resolve({ state: "active", page: "2" }) }),
    );

    expect(html).toContain('<option value="active" selected=""');
    expect(html).toContain('href="/panel/modules?state=active"');
    expect(html).toContain('href="/panel/modules?state=active&amp;page=3"');
    const request = routeHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(
      "http://panel.internal/api/v1/modules?limit=20&offset=20&state=active",
    );
  });

  it("paginates the filtered total, not the unfiltered catalogue", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: [MODULES[0]], total: 21 }));

    const html = renderToStaticMarkup(
      await ModulesPage({ searchParams: Promise.resolve({ state: "active" }) }),
    );

    // 21 filtered rows over a 20-row page is two pages; the total comes from the Core.
    expect(html).toContain("Page 1 of 2");
    expect(html).toContain('href="/panel/modules?state=active&amp;page=2"');
  });

  it("the clear link resets every filter to its default", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: MODULES, total: 2 }));

    const html = renderToStaticMarkup(
      await ModulesPage({ searchParams: Promise.resolve({ state: "disabled", public: "no" }) }),
    );

    expect(html).toContain('href="/panel/modules"');
    expect(html).toContain("Clear filter");
  });

  it("does not show the clear link on the default All view", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: MODULES, total: 2 }));

    const html = renderToStaticMarkup(await ModulesPage({ searchParams: Promise.resolve({ state: "all" }) }));

    expect(html).not.toContain("Clear filter");
  });
});

describe("ModulesPage filters", () => {
  it("applies the state and public selects on change: no Apply button", async () => {
    routeHandlerMock.mockResolvedValue(json({ modules: MODULES, total: 2 }, 200));

    const html = renderToStaticMarkup(
      await ModulesPage({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain('name="state"');
    expect(html).toContain('name="public"');
    expect(html).not.toContain(">Apply<");
    expect(html).not.toContain('type="submit"');
  });
});
