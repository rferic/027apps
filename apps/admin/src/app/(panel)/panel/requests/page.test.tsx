import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadInvitationRequestsMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/panel-i18n", () => ({
  loadPanelMessages: async () => ({}),
}));

vi.mock("@/lib/panel-settings", () => ({
  loadPanelTimeZone: async () => "UTC",
}));

vi.mock("@/lib/invitation-requests", () => ({
  loadInvitationRequests: (input: unknown) => loadInvitationRequestsMock(input),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import RequestsPage, { instant } from "./page";

const PENDING = {
  id: "r1",
  requester: { id: "u1", display_name: "Ana García", level: 1 },
  amount: 2,
  reason: "Para mi hermana",
  state: "pending",
  granted_amount: null,
  resolution_reason: null,
  resolved_by: null,
  resolved_at: null,
  created_at: "2026-11-18T00:00:00.000Z",
  quota: { level: 1, base: 5, granted: 1, used: 4, reserved: 2, remaining: 0, unlimited: false },
};

const APPROVED = {
  ...PENDING,
  id: "r2",
  requester: { id: "u2", display_name: "Luis Pérez", level: 3 },
  amount: 1,
  reason: null,
  state: "approved",
  granted_amount: 1,
  resolved_at: "2026-11-19T00:00:00.000Z",
  quota: { level: 3, base: 1, granted: 0, used: 1, reserved: 0, remaining: 0, unlimited: false },
};

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
  loadInvitationRequestsMock.mockReset();
});

describe("RequestsPage", () => {
  it("opts the segment out of the static shell (the layout opt-out is not inherited)", () => {
    expect(instant).toBe(false);
  });

  it("lists pending first with requester, amount, reason and live quota", async () => {
    loadInvitationRequestsMock.mockResolvedValue({ ok: true, requests: [PENDING, APPROVED], total: 2 });

    const html = renderToStaticMarkup(await RequestsPage());

    expect(html).toContain("Requests");
    expect(html).toContain("Ana García");
    expect(html).toContain("Para mi hermana");
    expect(html).toContain(">2<");
    expect(html).toContain("4/6");
    expect(html).toContain("Luis Pérez");
    expect(html).toContain("1/1");
    expect(loadInvitationRequestsMock).toHaveBeenCalledWith({ offset: 0 });
  });

  it("renders the generic 403 and never loads the list when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await RequestsPage());

    expect(html).toContain("You do not have access to this page.");
    expect(html).toContain("Log out");
    expect(loadInvitationRequestsMock).not.toHaveBeenCalled();
  });

  it("shows the empty state when there are no requests", async () => {
    loadInvitationRequestsMock.mockResolvedValue({ ok: true, requests: [], total: 0 });

    const html = renderToStaticMarkup(await RequestsPage());

    expect(html).toContain("No requests yet.");
    expect(html).not.toContain("<table");
  });

  it("shows a load failure with the request id and a retry link", async () => {
    loadInvitationRequestsMock.mockResolvedValue({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });

    const html = renderToStaticMarkup(await RequestsPage());

    expect(html).toContain("load the requests.");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-500");
    expect(html).toContain('href="/panel/requests"');
  });
});
