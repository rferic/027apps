import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadApiKeysMock = vi.fn();
const loadApiKeyOwnersMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
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

vi.mock("@/lib/panel-keys", () => ({
  loadApiKeys: (input: unknown) => loadApiKeysMock(input),
  loadApiKeyOwners: () => loadApiKeyOwnersMock(),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import KeysPage, { instant } from "./page";

const OWN_KEY = {
  id: "k1",
  kind: "delegated" as const,
  name: "Zapier",
  scopes: ["users:read", "settings:read"],
  user_id: "u1",
  owner: "Sara",
  roleCap: null,
  prefix: "027_usr_",
  expiresAt: null,
  revoked_at: null,
  last_used_at: "2026-11-01T10:00:00.000Z",
  created_at: "2026-10-01T10:00:00.000Z",
};

const SERVICE_KEY = {
  ...OWN_KEY,
  id: "k2",
  kind: "service" as const,
  name: "Backup",
  user_id: null,
  owner: "Instance",
  roleCap: "super_admin" as const,
  prefix: "027_svc_",
  revoked_at: "2026-11-02T10:00:00.000Z",
  last_used_at: null,
};

function render(searchParams: Record<string, string> = {}) {
  return KeysPage({ searchParams: Promise.resolve(searchParams) });
}

/** Every anchor tag of a rendered fragment, to assert on attributes alone. */
function anchors(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
}

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "root@example.com", displayName: "Root", role: "super_admin" },
  });
  loadApiKeysMock.mockReset();
  loadApiKeyOwnersMock.mockReset();
  loadApiKeyOwnersMock.mockResolvedValue({
    ok: true,
    owners: [
      { id: "u1", name: "Sara" },
      { id: "u2", name: "Marta" },
    ],
  });
  redirectMock.mockClear();
});

describe("KeysPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("keeps the list on its own surface on wide screens", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 2 });
    const html = renderToStaticMarkup(await render({ state: "all" }));

    expect(html).toContain(
      'class="flex flex-col gap-4 rounded-card border border-border bg-surface p-4"',
    );
  });

  it("lists name, kind, owner, role cap, expiry, last use and status without the scopes", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 2 });

    const html = renderToStaticMarkup(await render({ state: "all" }));

    expect(html).toContain("Zapier");
    expect(html).toContain("Delegated");
    expect(html).toContain("Service");
    expect(html).toContain("Sara");
    expect(html).toContain("Instance");
    expect(html).toContain("Super administrator");
    expect(html).toContain("Active");
    expect(html).toContain("Revoked");
    expect(html).toContain("Never");
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toContain('href="/keys/new"');
    expect(html).not.toContain("api-key-create-title");
    expect(html).not.toContain("Requested scopes");
    expect(html).not.toContain("users:read");
    expect(html).not.toContain("027_usr_");
    expect(html).not.toContain("Revoke the API key");
  });

  it("links every row and every mobile card to the key detail", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 2 });

    const html = renderToStaticMarkup(await render({ state: "all" }));

    // The table and the mobile card both render the name as a link.
    expect(html.match(/href="\/keys\/k1"/g)).toHaveLength(2);
    expect(html.match(/href="\/keys\/k2"/g)).toHaveLength(2);
  });

  it("stretches the row link over the whole table row", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 2 });

    const html = renderToStaticMarkup(await render({ state: "all" }));
    const table = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
    const rowLinks = anchors(table).filter((tag) => tag.includes("after:absolute"));

    expect(table).toContain("border-separate");
    expect(rowLinks).toHaveLength(2);
    expect(rowLinks[0]).toContain('href="/keys/k1"');
    expect(rowLinks[1]).toContain('href="/keys/k2"');
  });

  it("wraps the whole mobile card in a link to the key detail", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY], total: 1 });

    const html = renderToStaticMarkup(await render());
    const cards = html.slice(html.indexOf("</table>"));
    const card = anchors(cards).find((tag) => tag.includes('href="/keys/k1"'));

    expect(card).toBeDefined();
    expect(card).toContain("flex min-h-11 flex-col");
    expect(card).toContain("focus-visible:outline-2");
  });

  it("filters by state through the API and offers to clear the filter", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [SERVICE_KEY], total: 1 });

    const html = renderToStaticMarkup(await render({ state: "revoked" }));

    expect(loadApiKeysMock).toHaveBeenCalledWith({ offset: 0, state: "revoked" });
    expect(html).toContain("Backup");
    expect(html).not.toContain("Zapier");
    expect(html).toContain("Clear filters");
    expect(html).toContain('href="/keys"');
  });

  it("shows the empty state linked to the create page", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [], total: 0 });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("No API keys yet.");
    expect(html).toContain('href="/keys/new"');
    expect(html).not.toContain("<table");
  });

  it("shows the error with the translated code, the request id and a retry link", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-500" });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("load the API keys.");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-500");
    expect(html).toContain('href="/keys"');
    expect(html).not.toContain("<table");
  });

  it("renders the generic 403 and never loads keys when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "admin" },
    });

    const html = renderToStaticMarkup(await render());

    expect(requirePanelMock).toHaveBeenCalledWith("super_admin");
    expect(html).toContain("You do not have access to this page.");
    expect(loadApiKeysMock).not.toHaveBeenCalled();
  });

  it("paginates with a fixed page size and keeps the state filter in the links", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [SERVICE_KEY], total: 45 });

    const html = renderToStaticMarkup(await render({ page: "2", state: "revoked" }));

    expect(loadApiKeysMock).toHaveBeenCalledWith({ offset: 20, state: "revoked" });
    expect(html).toContain("Page 2 of 3");
    expect(html).toContain('href="/keys?state=revoked"');
    expect(html).toContain('href="/keys?state=revoked&amp;page=3"');
  });

  it("keeps the pagination visible and disabled on a single page", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY], total: 1 });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Page 1 of 1");
    expect(html).toContain('aria-disabled="true"');
  });

  it("redirects only when the requested page is past the last one", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [], total: 40 });

    await expect(render({ page: "3", state: "active" })).rejects.toThrow(
      "NEXT_REDIRECT:/keys?page=2",
    );
  });
});

describe("KeysPage default filter", () => {
  it("starts on active even without a state parameter and omits it from the URL", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY], total: 45 });

    const html = renderToStaticMarkup(await render({ page: "2" }));

    expect(loadApiKeysMock).toHaveBeenCalledWith({ offset: 20, state: "active" });
    expect(html).toContain("Zapier");
    expect(html).not.toContain("Backup");
    expect(html).toContain('<option value="active" selected=""');
    expect(html).toContain('<option value="all"');
    expect(html).toContain('href="/keys"');
    expect(html).toContain('href="/keys?page=3"');
  });

  it("sends All as an explicit state=all and keeps it in the pagination", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 45 });

    const html = renderToStaticMarkup(await render({ state: "all", page: "2" }));

    expect(html).toContain("Zapier");
    expect(html).toContain("Backup");
    expect(html).toContain('<option value="all" selected=""');
    expect(html).toContain('href="/keys?state=all"');
    expect(html).toContain('href="/keys?state=all&amp;page=3"');
  });
});

describe("KeysPage filters", () => {
  it("applies the state select on change: no Apply button and the select is named", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 2 });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain('name="state"');
    expect(html).not.toContain(">Apply<");
    expect(html).not.toContain('type="submit"');
  });
});

const OWNER_ID = "11111111-1111-4111-8111-111111111111";

describe("KeysPage kind and owner filters", () => {
  it("sends kind and user to the API and keeps them in the pagination", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY], total: 45 });

    const html = renderToStaticMarkup(
      await render({ page: "2", kind: "delegated", user: OWNER_ID }),
    );

    expect(loadApiKeysMock).toHaveBeenCalledWith({
      offset: 20,
      state: "active",
      kind: "delegated",
      user: OWNER_ID,
    });
    expect(html).toContain("Page 2 of 3");
    expect(html).toContain(`href="/keys?kind=delegated&amp;user=${OWNER_ID}"`);
    expect(html).toContain(`href="/keys?kind=delegated&amp;user=${OWNER_ID}&amp;page=3"`);
  });

  it("combines state, kind and owner in the pagination links", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY], total: 45 });

    const html = renderToStaticMarkup(
      await render({ state: "all", page: "2", kind: "delegated", user: OWNER_ID }),
    );

    expect(loadApiKeysMock).toHaveBeenCalledWith({
      offset: 20,
      state: "all",
      kind: "delegated",
      user: OWNER_ID,
    });
    expect(html).toContain(
      `href="/keys?state=all&amp;kind=delegated&amp;user=${OWNER_ID}"`,
    );
    expect(html).toContain(
      `href="/keys?state=all&amp;kind=delegated&amp;user=${OWNER_ID}&amp;page=3"`,
    );
  });

  it("renders the type and owner selects with the active values", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY], total: 1 });

    const html = renderToStaticMarkup(
      await render({ kind: "delegated", user: OWNER_ID }),
    );

    expect(html).toContain('name="kind"');
    expect(html).toContain('<option value="delegated" selected=""');
    expect(html).toContain('name="user"');
    expect(html).toContain("All owners");
    expect(html).toContain("Sara");
    expect(html).toContain("Marta");
    expect(html).toContain(`<option value="${OWNER_ID}" selected=""`);
  });

  it("defaults the type to all without adding it to the URL", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY], total: 1 });

    const html = renderToStaticMarkup(await render());

    expect(loadApiKeysMock).toHaveBeenCalledWith({ offset: 0, state: "active" });
    expect(html).toContain('<option value="all" selected=""');
    expect(html).toContain('<option value="" selected=""');
    expect(html).not.toContain("Clear filters");
  });

  it("hides the owner select for service and cleans a stale user from the URL", async () => {
    await expect(render({ kind: "service", user: OWNER_ID })).rejects.toThrow(
      `NEXT_REDIRECT:/keys?kind=service`,
    );
    expect(loadApiKeysMock).not.toHaveBeenCalled();
    expect(loadApiKeyOwnersMock).not.toHaveBeenCalled();

    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [SERVICE_KEY], total: 1 });
    const html = renderToStaticMarkup(await render({ kind: "service" }));

    expect(html).not.toContain('name="user"');
    expect(html).toContain('name="kind"');
    expect(loadApiKeysMock).toHaveBeenCalledWith({ offset: 0, state: "active", kind: "service" });
  });

  it("clears state, kind and owner with Clear filters", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY, SERVICE_KEY], total: 2 });

    const html = renderToStaticMarkup(
      await render({ state: "revoked", kind: "delegated", user: OWNER_ID }),
    );

    expect(html).toContain("Clear filters");
    expect(html).toContain('href="/keys"');
  });

  it("keeps kind and user on the error retry link", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-500" });

    const html = renderToStaticMarkup(
      await render({ kind: "delegated", user: OWNER_ID }),
    );

    expect(html).toContain(`href="/keys?kind=delegated&amp;user=${OWNER_ID}"`);
  });

  it("shows a filter-specific empty state when a server filter matches nothing", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [], total: 0 });

    const html = renderToStaticMarkup(await render({ kind: "service" }));

    expect(html).toContain("No API keys match this filter.");
    expect(html).not.toContain("No API keys yet.");
  });
});

describe("KeysPage expired state", () => {
  const EXPIRED_KEY = {
    ...OWN_KEY,
    id: "k3",
    name: "Old automation",
    expiresAt: "2020-01-01T00:00:00.000Z",
  };

  it("sends state=expired to the API and shows the Expired badge", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [EXPIRED_KEY], total: 1 });

    const html = renderToStaticMarkup(await render({ state: "expired" }));

    expect(loadApiKeysMock).toHaveBeenCalledWith({ offset: 0, state: "expired" });
    expect(html).toContain('<option value="expired" selected=""');
    expect(html).toContain("Old automation");
    // The option label plus the row badge, in the table and the mobile card.
    expect((html.match(/>Expired</g) ?? []).length).toBe(3);
  });

  it("offers Expired between Active and Revoked in the state filter", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [OWN_KEY], total: 1 });

    const html = renderToStaticMarkup(await render());

    const active = html.indexOf('<option value="active"');
    const expired = html.indexOf('<option value="expired"');
    const revoked = html.indexOf('<option value="revoked"');
    const all = html.indexOf('<option value="all"');

    expect(active).toBeGreaterThan(-1);
    expect(expired).toBeGreaterThan(active);
    expect(revoked).toBeGreaterThan(expired);
    expect(all).toBeGreaterThan(revoked);
  });

  it("keeps the API total, never the number of rows it received", async () => {
    loadApiKeysMock.mockResolvedValue({ ok: true, apiKeys: [EXPIRED_KEY], total: 45 });

    const html = renderToStaticMarkup(await render({ state: "expired" }));

    expect(html).toContain("Page 1 of 3");
  });

  it("marks a revoked key as revoked even when its expiry is in the past", async () => {
    loadApiKeysMock.mockResolvedValue({
      ok: true,
      apiKeys: [{ ...EXPIRED_KEY, revoked_at: "2026-01-01T00:00:00.000Z" }],
      total: 1,
    });

    const html = renderToStaticMarkup(await render({ state: "all" }));

    expect((html.match(/>Revoked</g) ?? []).length).toBe(3);
    // Only the state select mentions Expired: the row is revoked, not expired.
    expect((html.match(/>Expired</g) ?? []).length).toBe(1);
  });
});
