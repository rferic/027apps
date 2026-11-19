import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { ModuleDelegable } from "./module-delegable";

function render(isPublic: boolean, delegable: boolean): string {
  return renderToStaticMarkup(
    <ModuleDelegable moduleKey="owe-no" isPublic={isPublic} delegable={delegable} messages={{}} />,
  );
}

describe("ModuleDelegable", () => {
  it("starts checked for a delegable private module and unchecked otherwise", () => {
    const isChecked = (html: string) => /<input[^>]*checked=""/.test(html);

    expect(isChecked(render(false, true))).toBe(true);
    expect(isChecked(render(false, false))).toBe(false);
  });

  it("explains that a public module is always inherited instead of offering a switch", () => {
    const html = render(true, false);

    expect(html).toContain("A public module is always inherited by invitees.");
    expect(html).not.toContain('type="checkbox"');
  });

  it("explains the rule for a private module", () => {
    const html = render(false, false);

    expect(html).toContain("Inherited by invitees (delegable)");
    expect(html).toContain("invitee inherits this private module");
  });
});
