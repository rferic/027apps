import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const ownersMock = vi.fn();
const countsMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/panel-i18n", () => ({
  loadPanelMessages: async () => ({}),
}));

vi.mock("@/lib/panel-keys", () => ({
  loadApiKeyOwners: () => ownersMock(),
  loadActiveDelegatedCounts: () => countsMock(),
}));

vi.mock("./actions", () => ({
  loadUserModulesAction: async () => ({ ok: true, modules: [] }),
}));

import NewApiKeyPage, { instant } from "./page";

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "root@example.com", displayName: "Root", role: "super_admin" },
  });
  ownersMock.mockReset();
  ownersMock.mockResolvedValue({
    ok: true,
    owners: [
      { id: "u1", name: "Root" },
      { id: "u2", name: "Ana" },
    ],
  });
  countsMock.mockReset();
  countsMock.mockResolvedValue({ u1: 1, u2: 5 });
});

describe("NewApiKeyPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("renders the breadcrumb, title, back link and the form on the page", async () => {
    const html = renderToStaticMarkup(await NewApiKeyPage());

    expect(html).toContain("Breadcrumb");
    expect(html).toContain("New API key");
    expect(html).toContain("Back");
    expect(html).toContain('href="/panel/keys"');
    expect(html).toContain("api-key-name");
    expect(html).not.toContain("<dialog");
  });

  it("offers service creation to a super_admin", async () => {
    const html = renderToStaticMarkup(await NewApiKeyPage());

    expect(html).toContain('value="service"');
  });

  it("offers the owner selector with the active users", async () => {
    const html = renderToStaticMarkup(await NewApiKeyPage());

    expect(html).toContain('name="owner_id"');
    expect(html).toContain("Ana");
  });

  it("renders the generic 403, requires super_admin and loads no owners when denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "admin@example.com", displayName: "Admin", role: "admin" },
    });

    const html = renderToStaticMarkup(await NewApiKeyPage());

    expect(requirePanelMock).toHaveBeenCalledWith("super_admin");
    expect(html).toContain("You do not have access to this page.");
    expect(html).not.toContain("api-key-name");
    expect(ownersMock).not.toHaveBeenCalled();
  });
});
