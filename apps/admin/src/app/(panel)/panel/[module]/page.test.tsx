import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/module-page-host", () => ({
  ModulePageHost: ({ moduleKey, route }: { moduleKey: string; route: string }) => (
    <p>{`host:${moduleKey}/${route}`}</p>
  ),
}));

import ModuleWorkspacePage from "./page";

describe("module workspace", () => {
  it("renders the module overview at /panel/<key>", async () => {
    const html = renderToStaticMarkup(
      await ModuleWorkspacePage({
        params: Promise.resolve({ module: "owe-no" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("host:owe-no/overview");
  });
});
