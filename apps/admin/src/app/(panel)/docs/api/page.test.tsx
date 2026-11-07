import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
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

vi.mock("@/components/api-reference", () => ({
  ApiReference: ({ url }: { url: string }) => <div data-doc-url={url}>Scalar reference</div>,
}));

import ApiDocsPage, { instant } from "./page";

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
});

describe("ApiDocsPage", () => {
  it("opts the segment out of the static shell (the layout opt-out is not inherited)", () => {
    expect(instant).toBe(false);
  });

  it("requires the admin role and renders Scalar against the generated document", async () => {
    const html = renderToStaticMarkup(await ApiDocsPage());

    expect(requirePanelMock).toHaveBeenCalledWith("admin");
    expect(html).toContain("API docs");
    expect(html).toContain('data-doc-url="/api/v1/openapi.json"');
    expect(html).toContain("Scalar reference");
  });

  it("renders the generic 403 without mounting the viewer when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({ denied: true, user: { displayName: "Ana", email: "a@b.c" } });

    const html = renderToStaticMarkup(await ApiDocsPage());

    expect(html).toContain("You do not have access to this page.");
    expect(html).not.toContain("Scalar reference");
    expect(html).not.toContain("/api/v1/openapi.json");
  });
});
