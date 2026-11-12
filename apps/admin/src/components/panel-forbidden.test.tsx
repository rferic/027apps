import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import { PanelForbidden } from "./panel-forbidden";

describe("PanelForbidden", () => {
  it("explains the refusal without enumerating routes or roles", () => {
    const html = renderToStaticMarkup(<PanelForbidden locale="en" messages={{}} />);

    expect(html).toContain("You do not have access to this page.");
    expect(html).not.toContain("Members");
    expect(html).not.toContain("Modules");
    expect(html).toContain('aria-label="Language"');
    expect(html).toContain("Log out");
  });

  it("greets the known user and keeps the language switcher and logout", () => {
    const html = renderToStaticMarkup(
      <PanelForbidden
        locale="es"
        messages={{ "Log out": "Cerrar sesión", Language: "Idioma" }}
        user={{ id: "user-1", displayName: "Ana", email: "ana@example.com" }}
      />,
    );

    expect(html).toContain("Ana");
    expect(html).toContain('action="sign-out"');
    expect(html).toContain("Cerrar sesión");
  });
});
