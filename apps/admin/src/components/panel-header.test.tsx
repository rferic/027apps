import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { PanelHeader } from "./panel-header";

const user = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "ana@example.com",
  displayName: "Ana",
  role: "admin" as const,
};

function renderHeader(instanceName: string) {
  return renderToStaticMarkup(
    <PanelHeader
      user={user}
      locale="es"
      messages={{}}
      instanceName={instanceName}
    />,
  );
}

describe("PanelHeader", () => {
  it("shows the inline heartbeat mark plus the instance name on the left", () => {
    const html = renderHeader("Familia García");

    expect(html).toContain("<svg");
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain("w-8");
    expect(html).toContain("Familia García");
    expect(html).not.toContain("/brand/mark.svg");
  });

  it("falls back to the product name when the instance has no name", () => {
    const html = renderHeader("");

    expect(html).toContain("<svg");
    expect(html).toContain("027Apps");
  });

  it("keeps language and theme inside the user menu, above Log out", () => {
    const html = renderHeader("Familia García");
    const menuStart = html.indexOf("data-user-menu");
    const menu = html.slice(menuStart);
    const outsideMenu = html.slice(0, menuStart);

    expect(menuStart).toBeGreaterThan(-1);
    expect(html.match(/aria-label="Language"/g)).toHaveLength(1);
    expect(html.match(/aria-label="Theme"/g)).toHaveLength(1);
    expect(outsideMenu).not.toContain('aria-label="Language"');
    expect(outsideMenu).not.toContain('aria-label="Theme"');

    expect(menu).toContain(">Theme</span>");
    expect(menu).toContain(">Language</span>");
    expect(menu.indexOf('aria-label="Theme"')).toBeLessThan(
      menu.indexOf('aria-label="Language"'),
    );
    expect(menu.indexOf('aria-label="Language"')).toBeLessThan(menu.indexOf("Log out"));
  });

  it("shows the member identity inside the user menu", () => {
    const html = renderHeader("Familia García");
    const menu = html.slice(html.indexOf("data-user-menu"));

    expect(menu).toContain("Ana");
    expect(menu).toContain(">Admin<");
    expect(menu).toContain("ana@example.com");
  });

  it("keeps the log out button in the user menu", () => {
    const html = renderHeader("Familia García");
    const menu = html.slice(html.indexOf("data-user-menu"));

    expect(menu).toContain("Log out");
    expect(menu).toContain("<form");
  });
});
