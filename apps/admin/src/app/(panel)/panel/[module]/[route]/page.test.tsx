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

import ModuleWorkspaceRoutePage from "./page";

describe("module workspace route", () => {
  it("redirects overview to the module home", async () => {
    await expect(
      ModuleWorkspaceRoutePage({
        params: Promise.resolve({ module: "owe-no", route: "overview" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/panel/owe-no");
  });

  it("renders any other declared route through the host", async () => {
    const html = renderToStaticMarkup(
      await ModuleWorkspaceRoutePage({
        params: Promise.resolve({ module: "owe-no", route: "groups" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("host:owe-no/groups");
  });
});
