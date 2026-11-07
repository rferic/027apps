import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { PanelHeader } from "./panel-header";

describe("PanelHeader", () => {
  it("shows the heartbeat mark plus the instance name on the left", () => {
    const html = renderToStaticMarkup(
      <PanelHeader
        user={{ id: "00000000-0000-0000-0000-000000000001", email: "ana@example.com", displayName: "Ana", role: "admin" }}
        locale="es"
        messages={{}}
        instanceName="Familia García"
        logoUrl={null}
      />,
    );

    expect(html).toContain("/brand/mark.svg");
    expect(html).toContain("Familia García");
  });

  it("falls back to the product name when the instance has no name", () => {
    const html = renderToStaticMarkup(
      <PanelHeader
        user={{ id: "00000000-0000-0000-0000-000000000001", email: "ana@example.com", displayName: "Ana", role: "admin" }}
        locale="es"
        messages={{}}
        instanceName=""
        logoUrl={null}
      />,
    );

    expect(html).toContain("/brand/mark.svg");
    expect(html).toContain("027Apps");
  });
});
