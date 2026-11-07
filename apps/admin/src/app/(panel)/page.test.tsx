import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadDashboardMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/panel-i18n", () => ({
  loadPanelMessages: async () => ({}),
}));

vi.mock("@/lib/panel-dashboard", () => ({
  loadPanelDashboard: () => loadDashboardMock(),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import DashboardPage, { instant } from "./page";

const READY = {
  ok: true as const,
  health: { status: "ok" as const, reasons: [] },
  setupIncomplete: false,
  kpis: {
    members: 5,
    activeMembers: 4,
    pendingInvitations: 2,
    activeModules: 3,
    totalModules: 4,
    categories: 2,
  },
  modules: [
    { key: "expenses", name: "Expenses", state: "active", isPublic: true },
    { key: "notes", name: "Notes", state: "disabled", isPublic: false },
  ],
};

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
  loadDashboardMock.mockReset();
  loadDashboardMock.mockResolvedValue(READY);
});

describe("DashboardPage", () => {
  it("opts the segment out of the static shell (the layout opt-out is not inherited)", () => {
    expect(instant).toBe(false);
  });

  it("leads with the ready state, the four KPIs and the module cards", async () => {
    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("Everything is ready.");
    expect(html).toContain("Active members");
    expect(html).toContain("Pending invitations");
    expect(html).toContain("Active modules");
    expect(html).toContain("Categories");
    expect(html).toContain(">4<");
    expect(html).toContain(">2<");
    expect(html).toContain(">3<");
    expect(html).toContain("Expenses");
    expect(html).toContain("Notes");
    expect(html).toContain('href="/modules"');
    expect(html).not.toContain("Setup is incomplete.");
    expect(html).not.toContain("The service is degraded.");
  });

  it("shows the incomplete setup headline and the link to the wizard", async () => {
    loadDashboardMock.mockResolvedValue({ ...READY, setupIncomplete: true });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("Setup is incomplete.");
    expect(html).toContain('href="/setup"');
    expect(html).toContain("Finish setup");
    expect(html).not.toContain("Everything is ready.");
  });

  it("shows the degraded banner with readable reasons", async () => {
    loadDashboardMock.mockResolvedValue({
      ...READY,
      health: { status: "degraded", reasons: ["database_unreachable"] },
    });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("The service is degraded.");
    expect(html).toContain("The database is unreachable.");
    expect(html).not.toContain("database_unreachable");
  });

  it("shows the error state with the request id and a retry link", async () => {
    loadDashboardMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-123" });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("We couldn&#x27;t load the dashboard.");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-123");
    expect(html).toContain('href="/"');
    expect(html).toContain("Try again");
    expect(html).not.toContain("Active members");
  });

  it("renders the generic 403 when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u1", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("You do not have access to this page.");
    expect(html).toContain("Log out");
    expect(loadDashboardMock).not.toHaveBeenCalled();
  });

  it("shows the module empty state instead of empty cards", async () => {
    loadDashboardMock.mockResolvedValue({ ...READY, modules: [] });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("No modules are installed yet.");
    expect(html).toContain("Install a module to make its features available to the instance.");
    expect(html).not.toContain("Expenses");
    expect(html).toContain("Active members");
  });

  it("replaces the four zeros with a next-step block when there is nothing yet", async () => {
    loadDashboardMock.mockResolvedValue({
      ...READY,
      kpis: {
        members: 0,
        activeMembers: 0,
        pendingInvitations: 0,
        activeModules: 0,
        totalModules: 0,
        categories: 0,
      },
      modules: [],
    });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("No members or modules yet.");
    expect(html).toContain("Invite members or install a module to get started.");
    expect(html).toContain('href="/invitations"');
    expect(html).not.toContain("Active members");
  });
});
