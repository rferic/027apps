import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadApiKeysMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/panel-i18n", () => ({
  loadPanelMessages: async () => ({}),
}));

vi.mock("@/lib/panel-settings", () => ({
  loadPanelTimeZone: async () => "UTC",
}));

vi.mock("@/lib/panel-keys", () => ({
  loadApiKeys: (input: unknown) => loadApiKeysMock(input),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import KeysPage, { instant } from "./page";

const OWN_KEY = {
  id: "k1",
  kind: "delegated" as const,
  name: "Zapier",
  scopes: ["users:read", "settings:read"],
  user_id: "u1",
  owner: "Sara",
  roleCap: null,
  prefix: "027_usr_",
  expiresAt: null,
  revoked_at: null,
  last_used_at: "2026-11-01T10:00:00.000Z",
  created_at: "2026-10-01T10:00:00.000Z",
};

const SERVICE_KEY = {
  ...OWN_KEY,
  id: "k2",
  kind: "service" as const,
  name: "Backup",
  user_id: null,
  owner: "Instance",
  roleCap: "super_admin" as const,
  prefix: "027_svc_",
  revoked_at: "2026-11-02T10:00:00.000Z",
  last_used_at: null,
};

function render(searchParams: Record<string, string> = {}) {
  return KeysPage({ searchParams: Promise.resolve(searchParams) });
}

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "root@example.com", displayName: "Root", role: "super_admin" },
  });
  loadApiKeysMock.mockReset();
  redirectMock.mockClear();
});

describe("KeysPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("lists name, kind, owner, role cap, prefix, scopes, dates and status as text", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 2 });

    const html = renderToStaticMarkup(await render({ state: "all" }));

    expect(html).toContain("Zapier");
    expect(html).toContain("027_usr_");
    expect(html).toContain("users:read, settings:read");
    expect(html).toContain("Requested scopes");
    expect(html).toContain("Delegated");
    expect(html).toContain("Service");
    expect(html).toContain("Sara");
    expect(html).toContain("Instance");
    expect(html).toContain("Super administrator");
    expect(html).toContain("Active");
    expect(html).toContain("Revoked");
    expect(html).toContain("Never");
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toContain('href="/keys/new"');
    expect(html).not.toContain("api-key-create-title");
  });

  it("marks the caller's own key and names its owner in the confirmation", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 2 });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("This is your key");
    expect(html).toContain("This key belongs to Sara.");
    expect(html).toContain("Revoke the API key Zapier?");
    expect(html).not.toContain("Revoke the API key Backup?");
  });

  it("names the instance in the confirmation for an active service key", async () => {
    loadApiKeysMock.mockResolvedValue({
      ok: true,
      apiKeys: [{ ...SERVICE_KEY, revoked_at: null }],
      total: 1,
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Revoke the API key Backup?");
    expect(html).toContain("This is an instance key.");
    expect(html).toContain("Super administrator");
  });

  it("filters by state and offers to clear the filter", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 2 });

    const html = renderToStaticMarkup(await render({ state: "revoked" }));

    expect(html).toContain("Backup");
    expect(html).not.toContain("Zapier");
    expect(html).toContain("Clear filter");
    expect(html).toContain('href="/keys"');
  });

  it("shows the empty state linked to the create page", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [], total: 0 });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("No API keys yet.");
    expect(html).toContain('href="/keys/new"');
    expect(html).not.toContain("<table");
  });

  it("shows the error with the translated code, the request id and a retry link", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-500" });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("load the API keys.");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-500");
    expect(html).toContain('href="/keys"');
    expect(html).not.toContain("<table");
  });

  it("renders the generic 403 and never loads keys when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "admin" },
    });

    const html = renderToStaticMarkup(await render());

    expect(requirePanelMock).toHaveBeenCalledWith("super_admin");
    expect(html).toContain("You do not have access to this page.");
    expect(loadApiKeysMock).not.toHaveBeenCalled();
  });

  it("paginates with a fixed page size and keeps the state filter in the links", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [SERVICE_KEY], total: 45 });

    const html = renderToStaticMarkup(await render({ page: "2", state: "revoked" }));

    expect(loadApiKeysMock).toHaveBeenCalledWith({ offset: 20 });
    expect(html).toContain("Page 2 of 3");
    expect(html).toContain('href="/keys?state=revoked"');
    expect(html).toContain('href="/keys?state=revoked&amp;page=3"');
  });

  it("keeps the pagination visible and disabled on a single page", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY], total: 1 });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Page 1 of 1");
    expect(html).toContain('aria-disabled="true"');
  });

  it("redirects only when the requested page is past the last one", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [], total: 40 });

    await expect(render({ page: "3", state: "active" })).rejects.toThrow(
      "NEXT_REDIRECT:/keys?page=2",
    );
  });
});

describe("KeysPage default filter", () => {
  it("starts on active even without a state parameter and omits it from the URL", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 45 });

    const html = renderToStaticMarkup(await render({ page: "2" }));

    expect(html).toContain("Zapier");
    expect(html).not.toContain("Backup");
    expect(html).toContain('<option value="active" selected=""');
    expect(html).toContain('<option value="all"');
    expect(html).toContain('href="/keys"');
    expect(html).toContain('href="/keys?page=3"');
  });

  it("sends All as an explicit state=all and keeps it in the pagination", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 45 });

    const html = renderToStaticMarkup(await render({ state: "all", page: "2" }));

    expect(html).toContain("Zapier");
    expect(html).toContain("Backup");
    expect(html).toContain('<option value="all" selected=""');
    expect(html).toContain('href="/keys?state=all"');
    expect(html).toContain('href="/keys?state=all&amp;page=3"');
  });
});

describe("KeysPage filters", () => {
  it("applies the state select on change: no Apply button and the select is named", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 2 });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain('name="state"');
    expect(html).not.toContain(">Apply<");
    expect(html).not.toContain('type="submit"');
  });
});
