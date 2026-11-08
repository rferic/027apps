import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const installModuleMock = vi.fn();
const revalidatePathMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/module-install", () => ({
  installModule: (key: string) => installModuleMock(key),
}));

import { installModuleAction } from "./actions";

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "admin", email: "admin@example.test", displayName: "Ana", role: "admin" },
  });
  installModuleMock.mockReset();
  installModuleMock.mockResolvedValue({ ok: true });
  revalidatePathMock.mockClear();
  redirectMock.mockClear();
});

describe("installModuleAction", () => {
  it("gates the action before reaching the Core route", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "user", email: "u@example.test", displayName: "U", role: "member" },
    });

    await expect(installModuleAction("debug")).resolves.toEqual({
      ok: false,
      reason: "forbidden",
    });

    expect(requirePanelMock).toHaveBeenCalledWith("admin");
    expect(installModuleMock).not.toHaveBeenCalled();
  });

  it("rejects a key that is not a valid module key", async () => {
    await expect(installModuleAction("../debug")).resolves.toEqual({
      ok: false,
      reason: "failed",
    });

    expect(installModuleMock).not.toHaveBeenCalled();
  });

  it("rejects a key longer than the 64-character limit", async () => {
    await expect(installModuleAction("a".repeat(65))).resolves.toEqual({
      ok: false,
      reason: "failed",
    });

    expect(installModuleMock).not.toHaveBeenCalled();
  });

  it("installs, revalidates the list and redirects to the module detail", async () => {
    await expect(installModuleAction("debug")).rejects.toThrow(
      "NEXT_REDIRECT:/modules/debug",
    );

    expect(installModuleMock).toHaveBeenCalledWith("debug");
    expect(revalidatePathMock).toHaveBeenCalledWith("/modules");
    expect(redirectMock).toHaveBeenCalledWith("/modules/debug");
  });

  it("reports an already-installed module with its request id", async () => {
    installModuleMock.mockResolvedValue({
      ok: false,
      reason: "already_installed",
      requestId: "req-409",
    });

    await expect(installModuleAction("debug")).resolves.toEqual({
      ok: false,
      reason: "already_installed",
      requestId: "req-409",
    });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("reports an invalid manifest", async () => {
    installModuleMock.mockResolvedValue({
      ok: false,
      reason: "invalid_manifest",
      requestId: "req-400",
    });

    await expect(installModuleAction("debug")).resolves.toEqual({
      ok: false,
      reason: "invalid_manifest",
      requestId: "req-400",
    });
  });

  it("reports a permission failure", async () => {
    installModuleMock.mockResolvedValue({
      ok: false,
      reason: "forbidden",
      requestId: "req-403",
    });

    await expect(installModuleAction("debug")).resolves.toEqual({
      ok: false,
      reason: "forbidden",
      requestId: "req-403",
    });
  });
});
