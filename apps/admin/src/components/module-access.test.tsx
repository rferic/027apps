import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { ModuleAccess } from "./module-access";

function render(isPublic: boolean): string {
  return renderToStaticMarkup(
    <ModuleAccess moduleKey="owe-no" isPublic={isPublic} messages={{}} />,
  );
}

describe("module access", () => {
  it("starts checked for a public module and unchecked for a private one", () => {
    const isChecked = (html: string) => /<input[^>]*checked=""/.test(html);

    expect(isChecked(render(true))).toBe(true);
    expect(isChecked(render(false))).toBe(false);
  });

  it("explains what public means for the app", () => {
    const html = render(true);

    expect(html).toContain("Who can use it");
    expect(html).toContain("Every user (public module)");
    expect(html).toContain("without individual grants");
  });

  it("does not claim to be saving when idle", () => {
    expect(render(false)).not.toContain("Saving…");
  });
});
