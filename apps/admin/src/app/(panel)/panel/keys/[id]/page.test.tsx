import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadKeyMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
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
  loadKey: (id: string) => loadKeyMock(id),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import KeyPage, { instant } from "./page";

const KEY = {
  id: "k1",
  kind: "delegated" as const,
  name: "Zapier",
  scopes: ["users:read", "inventory:read_write"],
  user_id: "u1",
  owner: "Sara",
  roleCap: null,
  prefix: "027_usr_",
  expiresAt: null,
  revoked_at: null,
  last_used_at: null,
  created_at: "2026-10-01T10:00:00.000Z",
};

const SERVICE_KEY = {
  ...KEY,
  id: "k2",
  kind: "service" as const,
  name: "Backup",
  scopes: ["settings:read"],
  user_id: null,
  owner: "Instance",
  roleCap: "super_admin" as const,
  prefix: "027_svc_",
};

const REVOKED_KEY = {
  ...KEY,
  revoked_at: "2026-11-02T10:00:00.000Z",
};

function render(id = "k1") {
  return KeyPage({ params: Promise.resolve({ id }) });
}

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "root@example.com", displayName: "Root", role: "super_admin" },
  });
  loadKeyMock.mockReset();
  notFoundMock.mockClear();
});

describe("KeyDetailPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("shows the breadcrumb, the name, the type and the status badges", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: KEY });

    const html = renderToStaticMarkup(await render());

    expect(requirePanelMock).toHaveBeenCalledWith("super_admin");
    expect(html).toContain('href="/panel/keys"');
    expect(html).toContain("<h1");
    expect(html).toContain("Zapier");
    expect(html).toContain("Delegated");
    expect(html).toContain("Active");
    expect(html).toMatch(/<section[^>]*api-key-revoke-title[^>]*rounded-card/);
    expect(loadKeyMock).toHaveBeenCalledWith("k1");
  });

  it("shows the owner, prefix, dates and last use", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: KEY });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Owner");
    expect(html).toContain("Sara");
    expect(html).toContain("027_usr_");
    expect(html).toContain("Created");
    expect(html).toContain("Expires");
    expect(html).toContain("Never");
    expect(html).toContain("Last used");
  });

  it("labels a service key as the instance and shows its role cap", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: SERVICE_KEY });

    const html = renderToStaticMarkup(await render("k2"));

    expect(html).toContain("Instance");
    expect(html).toContain("Role cap");
    expect(html).toContain("Super administrator");
    expect(html).toContain("Service");
  });

  it("does not show a role cap for a delegated key", async () => {
    loadKeyMock.mockResolvedValue({
      ok: true,
      apiKey: { ...KEY, roleCap: "admin" },
    });

    const html = renderToStaticMarkup(await render());

    expect(html).not.toContain("Role cap");
    expect(html).not.toContain("Administrator");
  });

  it("renders every scope as a chip, with a readable name when one is known", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: KEY });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Permissions");
    expect(html).toContain("Read members");
    // A module scope has no label map entry: the identifier is shown as is.
    expect(html).toContain("inventory:read_write");
    expect(html).not.toContain("users:read");
  });

  it("offers Revoke with the confirmation and owner while the key is active", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: KEY });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain(">Revoke</button>");
    expect(html).toContain("Revoke the API key Zapier?");
    expect(html).toContain("This key belongs to Sara.");
  });

  it("offers an Edit link next to Revoke while the key is active", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: KEY });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain('href="/panel/keys/k1/edit"');
    expect(html).toContain(">Edit<");
  });

  it("never offers Revoke or Edit for a revoked key", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: REVOKED_KEY });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Revoked");
    expect(html).not.toContain(">Revoke</button>");
    expect(html).not.toContain("Revoke the API key Zapier?");
    expect(html).not.toContain('href="/panel/keys/k1/edit"');
    expect(html).not.toContain(">Edit<");
  });

  it("treats a missing key as a real 404", async () => {
    loadKeyMock.mockResolvedValue({ ok: false, code: "not_found" });

    await expect(render("missing")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("shows a load failure with the request id and a retry link", async () => {
    loadKeyMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-500" });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("load this API key.");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-500");
    expect(html).toContain('href="/panel/keys/k1"');
  });

  it("renders the generic 403 and never loads the key when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "admin" },
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("You do not have access to this page.");
    expect(loadKeyMock).not.toHaveBeenCalled();
  });
});
