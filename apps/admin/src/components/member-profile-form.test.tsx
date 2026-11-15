import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/panel/members/m1",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { MemberProfileForm } from "./member-profile-form";

const MEMBER = {
  id: "m1",
  display_name: "Ana",
  email: "ana@example.com",
  emailUnavailable: false,
  locale: "es",
  timezone: "Europe/Madrid",
  role: "user" as const,
  created_at: "2026-11-01T10:00:00.000Z",
  deactivated_at: null,
  categories: [],
};

describe("MemberProfileForm", () => {
  it("renders on a surface of its own so it does not float on wide screens", () => {
    const html = renderToStaticMarkup(
      <MemberProfileForm
        member={MEMBER}
        viewerRole="super_admin"
        isSelf={false}
        messages={{}}
      />,
    );

    expect(html).toMatch(/<form[^>]*rounded-card[^>]*bg-surface/);
    expect(html).toContain("Ana");
  });
});
