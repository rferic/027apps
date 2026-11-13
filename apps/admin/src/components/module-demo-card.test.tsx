import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DemoStatus } from "@027apps/core/demo/service.js";
import { DemoCardView } from "./module-demo-card";

vi.mock("@/app/(panel)/panel/modules/[key]/settings/demo-actions", () => ({
  seedDemoAction: vi.fn(),
  clearDemoAction: vi.fn(),
}));

const DEMO: DemoStatus = {
  enabled: true,
  production: false,
  seeded: false,
  seeded_at: null,
  members: 0,
  modules: [],
};

function render(overrides: Partial<Parameters<typeof DemoCardView>[0]> = {}): string {
  return renderToStaticMarkup(
    <DemoCardView
      demo={DEMO}
      pending={false}
      failure={null}
      saved={null}
      messages={{}}
      onSeed={() => undefined}
      onClear={() => undefined}
      {...overrides}
    />,
  );
}

describe("demo card", () => {
  it("installs and clears, and cannot clear when nothing is seeded", () => {
    const html = render();
    expect(html).toContain("Install demo data");
    expect(html).toContain("Clear demo data");
    expect(html).toContain("disabled");
    expect(html).toContain("Demo data not installed");
  });

  it("shows the members, the module counts and the production refusal", () => {
    const html = render({
      demo: {
        ...DEMO,
        seeded: true,
        seeded_at: "2026-11-13T10:00:00.000Z",
        members: 3,
        modules: [{ module_key: "fixture", result: { notes: 1 } }],
      },
      failure: { ok: false, reason: "linked" },
    });
    expect(html).toContain("Demo data installed");
    expect(html).toContain("3");
    expect(html).toContain("fixture");
    expect(html).toContain("still holds demo data");
  });

  it("reports a cleared run", () => {
    const html = render({ saved: { ok: true, demo: DEMO } });
    expect(html).toContain("Demo data cleared.");
  });
});
