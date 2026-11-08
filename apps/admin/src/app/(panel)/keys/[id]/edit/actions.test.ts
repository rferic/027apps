import { beforeEach, describe, expect, it, vi } from "vitest";

const updateKeyMock = vi.fn();
const loadKeyMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/panel-keys", () => ({
  loadKey: (id: string) => loadKeyMock(id),
  updateKey: (id: string, patch: unknown) => updateKeyMock(id, patch),
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
  redirectMock.mockClear();
});

describe("updateKeyAction", () => {
  it("sends the name and every selected scope, then returns to the key", async () => {
    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({ name: "  Renamed  ", scopes: ["profile:read", "modules:read"] }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/keys/k1");

    expect(updateKeyMock).toHaveBeenCalledWith("k1", {
      name: "Renamed",
      scopes: ["profile:read", "modules:read"],
    });
    expect(redirectMock).toHaveBeenCalledWith("/keys/k1");
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
    ).rejects.toThrow("NEXT_REDIRECT:/keys/k1");

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
    ).rejects.toThrow("NEXT_REDIRECT:/keys/k1");

    expect(updateKeyMock).toHaveBeenCalledWith("k1", {
      name: "Renamed",
      scopes: ["recetas:read_write"],
    });
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

  it("sends an expiry only when it changed", async () => {
    await expect(
      updateKeyAction(
        "k1",
        INITIAL_API_KEY_EDIT_STATE,
        formData({
          name: "Renamed",
          scopes: ["profile:read"],
          expires_at: "2027-05-01T10:00",
          current_expires_at: "",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(updateKeyMock).toHaveBeenCalledWith("k1", {
      name: "Renamed",
      scopes: ["profile:read"],
      expires_at: new Date("2027-05-01T10:00").toISOString(),
    });
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
