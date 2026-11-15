import { beforeEach, describe, expect, it, vi } from "vitest";

const updateKeyMock = vi.fn();
const loadKeyMock = vi.fn();
const loadUserModulesMock = vi.fn();
const requirePanelMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  order.push(`redirect:${url}`);
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const revalidatePathMock = vi.fn((path: string) => {
  order.push(`revalidate:${path}`);
});
/** Records the call order: `revalidatePath` must run before the redirect. */
const order: string[] = [];

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/panel-keys", () => ({
  loadKey: (id: string) => loadKeyMock(id),
  updateKey: (id: string, patch: unknown) => updateKeyMock(id, patch),
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

const STORED_KEY = {
  ok: true,
  apiKey: { id: "k1", kind: "delegated", roleCap: null, scopes: ["profile:read"] },
};

import { INITIAL_API_KEY_EDIT_STATE } from "@/lib/api-key-edit";
import { updateKeyAction } from "./actions";

function formData(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const entry of Array.isArray(value) ? value : [value]) data.append(key, entry);
  }
  return data;
}

beforeEach(() => {
  updateKeyMock.mockReset();
  updateKeyMock.mockResolvedValue({ ok: true, apiKey: { id: "k1" } });
  loadKeyMock.mockReset();
  loadKeyMock.mockResolvedValue(STORED_KEY);
  loadUserModulesMock.mockReset();
  loadUserModulesMock.mockResolvedValue({ ok: true, modules: [] });
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "root", email: "root@example.test", displayName: "Root", role: "super_admin" },
  });
  redirectMock.mockClear();
  revalidatePathMock.mockClear();
  order.length = 0;
});

describe("updateKeyAction", () => {
  it("refuses a panel admin before reaching the API", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "admin", email: "a@example.test", displayName: "Ana", role: "admin" },
    });

    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "Renamed", scopes: ["profile:read"] }),
      ),
    ).resolves.toEqual({ error: { ok: false, code: "insufficient_scope" } });

    expect(requirePanelMock).toHaveBeenCalledWith("super_admin");
    expect(loadKeyMock).not.toHaveBeenCalled();
    expect(updateKeyMock).not.toHaveBeenCalled();
  });

  it("sends the name and every selected scope, then returns to the key", async () => {
    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "  Renamed  ", scopes: ["profile:read", "modules:read"] }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/panel/keys/k1");

    expect(updateKeyMock).toHaveBeenCalledWith("k1", {
      name: "Renamed",
      scopes: ["profile:read", "modules:read"],
    });
    expect(redirectMock).toHaveBeenCalledWith("/panel/keys/k1");
  });

  it("invalidates the list, the detail and the edit form before redirecting", async () => {
    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "Renamed", scopes: ["profile:read"] }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/panel/keys/k1");

    // Without this the client Router Cache keeps serving the previous RSC, so
    // reopening the form shows the scopes that were just removed.
    expect(revalidatePathMock.mock.calls).toEqual([["/panel/keys"], ["/panel/keys/k1"], ["/panel/keys/k1/edit"]]);
    expect(order).toEqual([
      "revalidate:/panel/keys",
      "revalidate:/panel/keys/k1",
      "revalidate:/panel/keys/k1/edit",
      "redirect:/panel/keys/k1",
    ]);
  });

  it("encodes the id in the invalidated paths", async () => {
    loadKeyMock.mockResolvedValue({
      ok: true,
      apiKey: { ...STORED_KEY.apiKey, id: "a/b" },
    });

    await expect(
      updateKeyAction("a/b", INITIAL_API_KEY_EDIT_STATE, formData({ name: "Renamed", scopes: ["profile:read"] })),
    ).rejects.toThrow("NEXT_REDIRECT:/panel/keys/a%2Fb");

    expect(revalidatePathMock.mock.calls).toEqual([
      ["/panel/keys"],
      ["/panel/keys/a%2Fb"],
      ["/panel/keys/a%2Fb/edit"],
    ]);
  });

  it("sends the stored module scopes alongside the core selection", async () => {
    loadKeyMock.mockResolvedValue({
      ok: true,
      apiKey: {
        id: "k1",
        kind: "delegated",
        roleCap: null,
        scopes: ["profile:read", "recetas:read_write"],
      },
    });

    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "Renamed", scopes: ["profile:read", "modules:read"] }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/panel/keys/k1");

    expect(updateKeyMock).toHaveBeenCalledWith("k1", {
      name: "Renamed",
      scopes: ["recetas:read_write", "profile:read", "modules:read"],
    });
  });

  it("re-injects a module scope the client tried to drop", async () => {
    loadKeyMock.mockResolvedValue({
      ok: true,
      apiKey: {
        id: "k1",
        kind: "delegated",
        roleCap: null,
        scopes: ["profile:read", "recetas:read_write"],
      },
    });

    await expect(
      updateKeyAction("k1", INITIAL_API_KEY_EDIT_STATE, formData({ name: "Renamed" })),
    ).rejects.toThrow("NEXT_REDIRECT:/panel/keys/k1");

    expect(updateKeyMock).toHaveBeenCalledWith("k1", {
      name: "Renamed",
      scopes: ["recetas:read_write"],
    });
  });

  it("loads the owner's modules and keeps a newly selected module scope", async () => {
    loadKeyMock.mockResolvedValue({
      ok: true,
      apiKey: {
        id: "k1",
        kind: "delegated",
        roleCap: null,
        user_id: "u1",
        scopes: ["profile:read"],
      },
    });
    loadUserModulesMock.mockResolvedValue({
      ok: true,
      modules: [{ key: "recetas", name: "Recetas" }],
    });

    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "Renamed", scopes: ["profile:read", "recetas:read"] }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/panel/keys/k1");

    expect(loadUserModulesMock).toHaveBeenCalledWith("u1");
    expect(updateKeyMock).toHaveBeenCalledWith("k1", {
      name: "Renamed",
      scopes: ["profile:read", "recetas:read"],
    });
  });

  it("lets the form remove a module scope the owner still has", async () => {
    loadKeyMock.mockResolvedValue({
      ok: true,
      apiKey: {
        id: "k1",
        kind: "delegated",
        roleCap: null,
        user_id: "u1",
        scopes: ["profile:read", "recetas:read_write"],
      },
    });
    loadUserModulesMock.mockResolvedValue({
      ok: true,
      modules: [{ key: "recetas", name: "Recetas" }],
    });

    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "Renamed", scopes: ["profile:read"] }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/panel/keys/k1");

    expect(updateKeyMock).toHaveBeenCalledWith("k1", {
      name: "Renamed",
      scopes: ["profile:read"],
    });
  });

  it("keeps a stored module scope the owner no longer has", async () => {
    loadKeyMock.mockResolvedValue({
      ok: true,
      apiKey: {
        id: "k1",
        kind: "delegated",
        roleCap: null,
        user_id: "u1",
        scopes: ["profile:read", "recetas:read_write"],
      },
    });
    loadUserModulesMock.mockResolvedValue({
      ok: true,
      modules: [{ key: "fotos", name: "Fotos" }],
    });

    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "Renamed", scopes: ["profile:read"] }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/panel/keys/k1");

    expect(updateKeyMock).toHaveBeenCalledWith("k1", {
      name: "Renamed",
      scopes: ["recetas:read_write", "profile:read"],
    });
  });

  it("does not write a partial patch when the owner's modules cannot be loaded", async () => {
    loadKeyMock.mockResolvedValue({
      ok: true,
      apiKey: {
        id: "k1",
        kind: "delegated",
        roleCap: null,
        user_id: "u1",
        scopes: ["profile:read"],
      },
    });
    loadUserModulesMock.mockResolvedValue({ ok: false, code: "insufficient_scope" });

    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "Renamed", scopes: ["profile:read"] }),
      ),
    ).resolves.toEqual({ error: { ok: false, code: "insufficient_scope" } });
    expect(updateKeyMock).not.toHaveBeenCalled();
  });

  it("keeps a load failure as state instead of writing a partial patch", async () => {
    loadKeyMock.mockResolvedValue({ ok: false, code: "not_found" });

    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "Renamed", scopes: ["profile:read"] }),
      ),
    ).resolves.toEqual({ error: { ok: false, code: "not_found" } });
    expect(updateKeyMock).not.toHaveBeenCalled();
  });

  it("keeps the current expiry when the keep mode is selected", async () => {
    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "Renamed", scopes: ["profile:read"], expiry_mode: "keep" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(updateKeyMock).toHaveBeenCalledWith("k1", {
      name: "Renamed",
      scopes: ["profile:read"],
    });
  });

  it("clears the expiry with the never mode", async () => {
    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "Renamed", scopes: ["profile:read"], expiry_mode: "never" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(updateKeyMock).toHaveBeenCalledWith("k1", {
      name: "Renamed",
      scopes: ["profile:read"],
      expires_at: null,
    });
  });

  it("computes a relative expiry in the future", async () => {
    const before = Date.now();

    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({
          name: "Renamed",
          scopes: ["profile:read"],
          expiry_mode: "relative",
          expiry_amount: "30",
          expiry_unit: "days",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    const patch = updateKeyMock.mock.calls[0]?.[1] as { expires_at?: string };
    const offset = new Date(patch.expires_at ?? "").getTime() - before;
    expect(offset).toBeGreaterThanOrEqual(30 * 86_400_000);
    expect(offset).toBeLessThan(30 * 86_400_000 + 5_000);
  });

  it("rejects an invalid relative amount without calling the API", async () => {
    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({
          name: "Renamed",
          scopes: ["profile:read"],
          expiry_mode: "relative",
          expiry_amount: "0",
          expiry_unit: "days",
        }),
      ),
    ).resolves.toEqual({ error: { ok: false, code: "validation_failed" } });
    expect(updateKeyMock).not.toHaveBeenCalled();
  });

  it("keeps the API failure as state instead of leaving the page", async () => {
    updateKeyMock.mockResolvedValue({ ok: false, code: "conflict", details: { code: "revoked" } });

    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "Renamed", scopes: ["profile:read"] }),
      ),
    ).resolves.toEqual({
      error: { ok: false, code: "conflict", details: { code: "revoked" } },
    });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects an empty name or an empty scope set without calling the API", async () => {
    await expect(
      updateKeyAction("k1", INITIAL_API_KEY_EDIT_STATE, formData({ name: " ", scopes: ["x:read"] })),
    ).resolves.toEqual({ error: { ok: false, code: "validation_failed" } });

    await expect(
      updateKeyAction("k1", INITIAL_API_KEY_EDIT_STATE, formData({ name: "Renamed" })),
    ).resolves.toEqual({ error: { ok: false, code: "validation_failed" } });
    expect(updateKeyMock).not.toHaveBeenCalled();
  });
});
