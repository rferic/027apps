import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/member-mutations", () => ({
  purgeMember: vi.fn(),
}));

import { MemberPurgeAction } from "./member-purge-action";
import { PURGE_REDIRECT } from "@/lib/member-form";

describe("MemberPurgeAction", () => {
  it("keeps deletion in its own destructive section and disables the confirm button", () => {
    const html = renderToStaticMarkup(
      <MemberPurgeAction id="u1" name="Ana" isSelf={false} messages={{}} />,
    );

    expect(html).toContain("<section");
    expect(html).toContain("Danger zone");
    expect(html).toContain("Delete permanently");
    expect(html).toContain("This cannot be undone.");
    expect(html).toContain(">Delete Ana permanently?</h2>");
    expect(html).toContain('id="member-purge-confirm"');
    expect(html).toContain("Type Ana to confirm");
    // The confirm button stays disabled until the name is typed.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Delete permanently<\/button>/);
  });

  it("disappears for the caller's own account", () => {
    const html = renderToStaticMarkup(
      <MemberPurgeAction id="u1" name="Ana" isSelf messages={{}} />,
    );

    expect(html).toBe("");
  });

  it("returns to the member list after a successful purge", () => {
    expect(PURGE_REDIRECT).toBe("/members");
  });
});
