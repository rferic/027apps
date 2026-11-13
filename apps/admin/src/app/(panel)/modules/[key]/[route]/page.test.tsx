import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((_href: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("next/navigation", () => ({
  redirect: (href: string) => redirectMock(href),
}));

vi.mock("@/components/module-page-host", () => ({
  ModulePageHost: ({ moduleKey, route }: { moduleKey: string; route: string }) => (
    <p>{`host:${moduleKey}/${route}`}</p>
  ),
}));

import ModuleAdminPage from "./page";

describe("module admin route", () => {
  it("redirects the legacy overview path to the module entry", async () => {
    await expect(
      ModuleAdminPage({ params: Promise.resolve({ key: "fixture", route: "overview" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/modules/fixture");
  });

  it("renders any other declared route through the host", async () => {
    const html = renderToStaticMarkup(
      await ModuleAdminPage({ params: Promise.resolve({ key: "fixture", route: "notes" }) }),
    );
    expect(html).toContain("host:fixture/notes");
  });
});
