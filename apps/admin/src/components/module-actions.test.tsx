import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MutationFailure } from "@/lib/mutation-result";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/module-mutations", () => ({
  activateModule: vi.fn(),
  deactivateModule: vi.fn(),
  uninstallModule: vi.fn(),
}));

import { ModuleActions, uninstallOutcome } from "./module-actions";

const GRANTS_CONFLICT: MutationFailure = {
  ok: false,
  code: "conflict",
  requestId: "req-409",
  details: { code: "grants_active" },
};

describe("ModuleActions", () => {
  it("starts on the destructive confirmation, not on the grants one", () => {
    const html = renderToStaticMarkup(
      <ModuleActions
        moduleKey="inventory"
        name="Inventory"
        state="active"
        canUninstall
        messages={{}}
      />,
    );

    expect(html).toContain("Deactivate");
    expect(html).toContain("Uninstall");
    expect(html).toContain("Uninstall module");
    expect(html).not.toContain("Uninstall anyway");
  });

  it("hides the uninstall dialog from callers who may not uninstall", () => {
    const html = renderToStaticMarkup(
      <ModuleActions
        moduleKey="inventory"
        name="Inventory"
        state="active"
        canUninstall={false}
        messages={{}}
      />,
    );

    expect(html).not.toContain("Uninstall");
  });
});

describe("uninstallOutcome", () => {
  it("closes the dialog on success", () => {
    expect(uninstallOutcome({ ok: true }, false)).toEqual({ kind: "success" });
  });

  it("asks a second time only for the active-grants conflict", () => {
    expect(uninstallOutcome(GRANTS_CONFLICT, false)).toEqual({ kind: "grants" });
  });

  it("shows a plain error for a 409 with another reason (e.g. an unreverted migration)", () => {
    const conflict: MutationFailure = { ok: false, code: "conflict", requestId: "req-409" };

    expect(uninstallOutcome(conflict, false)).toEqual({ kind: "error", failure: conflict });
  });

  it("does not offer a third attempt after the confirmation", () => {
    expect(uninstallOutcome(GRANTS_CONFLICT, true)).toEqual({
      kind: "error",
      failure: GRANTS_CONFLICT,
    });
  });

  it("ignores the detail code outside a 409", () => {
    const validation: MutationFailure = {
      ok: false,
      code: "validation_failed",
      details: { code: "grants_active" },
    };

    expect(uninstallOutcome(validation, false)).toEqual({ kind: "error", failure: validation });
  });
});
