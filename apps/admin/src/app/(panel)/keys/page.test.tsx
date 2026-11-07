import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadApiKeysMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/panel-i18n", () => ({
  loadPanelMessages: async () => ({}),
}));

vi.mock("@/lib/panel-keys", () => ({
  loadApiKeys: () => loadApiKeysMock(),
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
  role_cap: null,
  prefix: "027_usr_",
  expires_at: null,
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
  role_cap: "admin" as const,
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
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
  loadApiKeysMock.mockReset();
});

describe("KeysPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("lists name, kind, prefix, scopes, dates and status as text", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY] });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Zapier");
    expect(html).toContain("027_usr_");
    expect(html).toContain("users:read, settings:read");
    expect(html).toContain("Delegated");
    expect(html).toContain("Service");
    expect(html).toContain("Active");
    expect(html).toContain("Revoked");
    expect(html).toContain("Never");
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
  });

  it("marks the caller's own key and offers revocation for active keys only", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY] });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("This is your key");
    expect(html).toContain("Revoke the API key Zapier?");
    expect(html).not.toContain("Revoke the API key Backup?");
  });

  it("never shows service creation to an admin", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [] });

    const html = renderToStaticMarkup(await render());

    expect(html).not.toContain('value="service"');
  });

  it("shows service creation to a super_admin", async () => {
    requirePanelMock.mockResolvedValue({
      user: { id: "u1", email: "root@example.com", displayName: "Root", role: "super_admin" },
    });
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [] });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain('value="service"');
  });

  it("filters by state and offers to clear the filter", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY] });

    const html = renderToStaticMarkup(await render({ state: "revoked" }));

    expect(html).toContain("Backup");
    expect(html).not.toContain("Zapier");
    expect(html).toContain("Clear filter");
    expect(html).toContain('href="/keys"');
  });

  it("shows the empty state when there are no keys", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [] });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("No API keys yet.");
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
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("You do not have access to this page.");
    expect(loadApiKeysMock).not.toHaveBeenCalled();
  });
});
