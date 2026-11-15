import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/panel/settings/instance",
}));

import { UserMenu, closesUserMenu } from "./user-menu";

describe("closesUserMenu", () => {
  it("closes an open menu on Escape", () => {
    expect(closesUserMenu({ open: true, event: "escape", inside: true })).toBe(true);
  });

  it("closes an open menu on a pointerdown outside it", () => {
    expect(closesUserMenu({ open: true, event: "pointerdown", inside: false })).toBe(true);
  });

  it("keeps the menu open on a pointerdown inside it", () => {
    expect(closesUserMenu({ open: true, event: "pointerdown", inside: true })).toBe(false);
  });

  it("ignores events when the menu is already closed", () => {
    expect(closesUserMenu({ open: false, event: "escape", inside: false })).toBe(false);
    expect(closesUserMenu({ open: false, event: "pointerdown", inside: false })).toBe(false);
  });
});

describe("UserMenu", () => {
  it("renders a native details with the summary and the menu content", () => {
    const html = renderToStaticMarkup(
      <UserMenu summary={<summary>Ana</summary>}>
        <div data-user-menu>ana@example.com</div>
      </UserMenu>,
    );

    expect(html).toContain("<details");
    expect(html).toContain("<summary>Ana</summary>");
    expect(html).toContain("data-user-menu");
    expect(html).toContain("ana@example.com");
    expect(html).not.toContain("open=");
  });
});
