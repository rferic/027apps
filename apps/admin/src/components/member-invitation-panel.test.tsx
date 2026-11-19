import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/member-mutations", () => ({
  revokeInvitationGrant: vi.fn(),
  setMemberInvitationLevel: vi.fn(),
}));

import { MemberInvitationPanel } from "./member-invitation-panel";
import type { InvitationGrant, InvitationQuota } from "@/lib/invitation-grants";

const QUOTA: InvitationQuota = {
  level: 1,
  base: 5,
  granted: 1,
  used: 1,
  reserved: 1,
  remaining: 4,
  unlimited: false,
};

function render(
  overrides: {
    role?: "super_admin" | "admin" | "user";
    invitation_level?: number | null;
    quota?: Partial<InvitationQuota>;
    grants?: InvitationGrant[];
  } = {},
): string {
  const member = {
    id: "u-1",
    role: (overrides.role ?? "user") as "super_admin" | "admin" | "user",
    invitation_level: overrides.invitation_level === undefined ? 1 : overrides.invitation_level,
  };
  return renderToStaticMarkup(
    <MemberInvitationPanel
      member={member}
      quota={{ ...QUOTA, ...overrides.quota }}
      grants={overrides.grants ?? []}
      locale="en"
      timeZone="UTC"
      messages={{}}
    />,
  );
}

const GRANT: InvitationGrant = {
  id: "g-1",
  user_id: "u-1",
  amount: 1,
  granted_by: { id: "a-1", display_name: "Eric" },
  request_id: null,
  reason: null,
  revoked_at: null,
  created_at: "2026-11-12T00:00:00.000Z",
};

describe("MemberInvitationPanel", () => {
  it("shows base, granted, used, reserved and remaining", () => {
    const html = render();

    expect(html).toContain("Invitation quota");
    expect(html).toContain("Base 5 + 1 granted");
    expect(html).toContain("1 used + 1 reserved");
    expect(html).toContain("4 remaining");
  });

  it("warns that no one can be invited at zero remaining", () => {
    const html = render({ quota: { remaining: 0 } });

    expect(html).toContain("No seats left. Ask the administrator for more.");
  });

  it("shows each grant with its granted_by and a revoke action", () => {
    const html = render({ grants: [GRANT] });

    expect(html).toContain(">+1 seat(s)</span>");
    expect(html).toContain("Eric");
    expect(html).toContain(">Revoke</button>");
    expect(html).not.toContain(">Revoked</span>");
  });

  it("marks a revoked grant and offers no revoke button", () => {
    const html = render({ grants: [{ ...GRANT, revoked_at: "2026-11-13T00:00:00.000Z" }] });

    expect(html).toContain(">Revoked</span>");
    expect(html).not.toContain(">Revoke</button>");
  });

  it("offers a level selector for a member", () => {
    const html = render({ invitation_level: 2 });

    expect(html).toContain('id="member-invitation-level"');
    expect(html).toContain(">Save</button>");
  });

  it("warns when a member has no level and offers an assign action", () => {
    const html = render({ invitation_level: null });

    expect(html).toContain("This member has no level, so they cannot invite anyone.");
    expect(html).toContain(">Assign level</button>");
  });

  it("gives an administrator no level selector", () => {
    const html = render({ role: "admin", invitation_level: null });

    expect(html).toContain("Administrators invite without a quota.");
    expect(html).not.toContain('id="member-invitation-level"');
    expect(html).not.toContain(">Assign level</button>");
  });

  it("shows an empty state when the member has no grants", () => {
    const html = render({ grants: [] });

    expect(html).toContain("No grants yet.");
  });
});
