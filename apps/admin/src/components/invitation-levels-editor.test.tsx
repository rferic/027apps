import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvitationLevelsEditor } from "./invitation-levels-editor";

function render(levels: Array<{ level: number; quota: number }>): string {
  return renderToStaticMarkup(
    <InvitationLevelsEditor value={levels} onChange={() => {}} messages={{}} />,
  );
}

describe("InvitationLevelsEditor", () => {
  it("renders one numbered row per level with its quota input", () => {
    const html = render([
      { level: 1, quota: 5 },
      { level: 2, quota: 2 },
      { level: 3, quota: 1 },
    ]);

    expect(html).toContain(">Level 1</span>");
    expect(html).toContain(">Level 2</span>");
    expect(html).toContain(">Level 3</span>");
    expect(html).toContain('aria-label="Level 1 seats"');
    expect(html).toContain('value="5"');
    expect(html).toContain('value="2"');
    expect(html).toContain('value="1"');
    // One remove button per row.
    expect((html.match(/>Remove<\/button>/g) ?? []).length).toBe(3);
  });

  it("shows the maximum accounts the table produces from one admin invitation", () => {
    // 1 + 5 + 5*2 + 5*2*1 = 26
    const html = render([
      { level: 1, quota: 5 },
      { level: 2, quota: 2 },
      { level: 3, quota: 1 },
    ]);

    expect(html).toContain("allows 26 accounts");
  });

  it("warns that only administrators can invite when the table is empty", () => {
    const html = render([]);

    expect(html).toContain("Only administrators can invite.");
    expect(html).toContain("allows 1 accounts");
  });

  it("disables adding once twenty levels exist", () => {
    const html = render(Array.from({ length: 20 }, (_, i) => ({ level: i + 1, quota: 1 })));

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Add level<\/button>/);
  });

  it("keeps an add button enabled below the cap", () => {
    const html = render([{ level: 1, quota: 5 }]);

    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Add level<\/button>/);
  });
});
