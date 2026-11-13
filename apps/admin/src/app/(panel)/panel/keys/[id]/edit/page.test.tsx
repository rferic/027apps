import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadKeyMock = vi.fn();
const loadUserModulesMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  redirect: (url: string) => redirectMock(url),
  usePathname: () => "/panel/keys/k1/edit",
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

vi.mock("@/lib/panel-user-modules", () => ({
  loadUserModules: (id: string) => loadUserModulesMock(id),
  loadModulesForOwner: (apiKey: { kind: string; user_id: string | null }) =>
    apiKey.kind === "delegated" && apiKey.user_id
      ? loadUserModulesMock(apiKey.user_id)
      : Promise.resolve(null),
  offeredModuleList: (result: { ok: boolean; modules?: unknown[] } | null) =>
    result?.ok ? result.modules : [],
  modulesFailure: (result: { ok: boolean } | null) => (result && !result.ok ? result : null),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import EditKeyPage, { instant } from "./page";
import { ApiKeyEditForm } from "@/components/api-key-edit-form";
import { apiKeyFingerprint } from "@/lib/api-key-edit";

const DELEGATED_KEY = {
  id: "k1",
  kind: "delegated" as const,
  name: "Zapier",
  // `settings:write` is a legacy scope the delegated allowlist no longer grants.
  scopes: ["users:read", "settings:write", "profile:read"],
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
  ...DELEGATED_KEY,
  id: "k2",
  kind: "service" as const,
  name: "Backup",
  scopes: ["settings:read"],
  user_id: null,
  owner: "Instance",
  roleCap: "super_admin" as const,
  prefix: "027_svc_",
};

function render(id = "k1") {
  return EditKeyPage({ params: Promise.resolve({ id }) });
}

/** The form element the page mounts, so its React `key` can be inspected. */
function findEditForm(node: ReactNode): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findEditForm(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (node.type === ApiKeyEditForm) return node;
  return findEditForm((node.props as { children?: ReactNode }).children);
}

async function mountForm(id = "k1"): Promise<ReactElement> {
  const form = findEditForm(await render(id));
  if (!form) throw new Error("the page did not mount the edit form");
  return form;
}

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "root@example.com", displayName: "Root", role: "super_admin" },
  });
  loadKeyMock.mockReset();
  loadUserModulesMock.mockReset();
  loadUserModulesMock.mockResolvedValue({ ok: true, modules: [] });
  notFoundMock.mockClear();
  redirectMock.mockClear();
});

describe("EditApiKeyPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("renders the current values on its own page, not in a dialog", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: DELEGATED_KEY });

    const html = renderToStaticMarkup(await render());

    expect(requirePanelMock).toHaveBeenCalledWith("super_admin");
    expect(html).toContain("<h1");
    expect(html).toContain("Edit API key");
    expect(html).toContain("<form");
    expect(html).not.toContain("<dialog");
    expect(html).toContain('value="Zapier"');
    expect(html).toContain("Sara");
    expect(html).toContain("027_usr_");
    expect(html).toContain("Changes apply from the next request on.");
    expect(html).toContain('href="/panel/keys/k1"');
  });

  it("offers only the scopes the delegated kind allows", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: DELEGATED_KEY });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain('value="profile:read"');
    expect(html).toContain('value="users:read"');
    expect(html).not.toContain('value="settings:write"');
    expect(html).not.toContain('value="maintenance:run"');
  });

  it("offers the service allowlist for a capped service key", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: SERVICE_KEY });

    const html = renderToStaticMarkup(await render("k2"));

    expect(html).toContain('value="settings:read"');
    expect(html).toContain('value="maintenance:run"');
    expect(html).toContain('value="settings:write"');
    expect(html).toContain("Super administrator");
  });

  it("remounts the form when the stored scopes change", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: DELEGATED_KEY });
    const before = await mountForm();

    loadKeyMock.mockResolvedValue({
      ok: true,
      apiKey: { ...DELEGATED_KEY, scopes: ["users:read"] },
    });
    const after = await mountForm();

    // A fresh RSC with different data must remount the client form: its scope
    // and expiry state is seeded from props only on mount.
    expect(before.key).toBe(apiKeyFingerprint(DELEGATED_KEY));
    expect(after.key).not.toBe(before.key);
  });

  it("keeps the form mounted when the data did not change", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: DELEGATED_KEY });
    const first = await mountForm();
    const second = await mountForm();

    expect(second.key).toBe(first.key);
  });

  it("never offers kind, owner or role cap as editable fields", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: DELEGATED_KEY });

    const html = renderToStaticMarkup(await render());

    expect(html).not.toContain('name="kind"');
    expect(html).not.toContain('name="owner_id"');
    expect(html).not.toContain('name="role_cap"');
    expect(html).not.toContain('name="user_id"');
  });

  it("offers the modules granted to the owner as editable permissions", async () => {
    loadKeyMock.mockResolvedValue({
      ok: true,
      apiKey: { ...DELEGATED_KEY, scopes: ["profile:read", "recetas:read_write"] },
    });
    loadUserModulesMock.mockResolvedValue({
      ok: true,
      modules: [{ key: "recetas", name: "Recetas" }],
    });

    const html = renderToStaticMarkup(await render());

    expect(loadUserModulesMock).toHaveBeenCalledWith("u1");
    expect(html).toContain("Recetas");
    expect(html).toContain('value="recetas:read"');
    expect(html).toContain('checked="" value="recetas:read_write"');
    expect(html).not.toContain("Not available");
  });

  it("does not load or offer modules for a service key", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: SERVICE_KEY });

    const html = renderToStaticMarkup(await render("k2"));

    expect(loadUserModulesMock).not.toHaveBeenCalled();
    expect(html).not.toContain('value="recetas:read"');
  });

  it("shows the owner's module load failure instead of silently dropping them", async () => {
    loadKeyMock.mockResolvedValue({ ok: true, apiKey: DELEGATED_KEY });
    loadUserModulesMock.mockResolvedValue({
      ok: false,
      code: "internal",
      requestId: "req-modules",
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("load the owner&#x27;s modules.");
    expect(html).toContain("req-modules");
  });

  it("passes the formatted current expiry to the form", async () => {
    loadKeyMock.mockResolvedValue({
      ok: true,
      apiKey: { ...DELEGATED_KEY, expiresAt: "2027-01-01T00:00:00.000Z" },
    });

    const form = await mountForm();

    expect((form.props as { currentLabel: string }).currentLabel).toBe("Jan 1, 2027");
  });

  it("treats a missing key as a real 404", async () => {
    loadKeyMock.mockResolvedValue({ ok: false, code: "not_found" });

    await expect(render("missing")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("sends a revoked key back to its read-only detail page", async () => {
    loadKeyMock.mockResolvedValue({
      ok: true,
      apiKey: { ...DELEGATED_KEY, revoked_at: "2026-11-02T10:00:00.000Z" },
    });

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/panel/keys/k1");
  });

  it("shows a load failure with the request id and a retry link", async () => {
    loadKeyMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-500" });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("load this API key.");
    expect(html).toContain("req-500");
    expect(html).toContain('href="/panel/keys/k1/edit"');
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
