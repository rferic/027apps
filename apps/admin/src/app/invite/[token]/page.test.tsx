import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  cookies: {} as Record<string, string>,
  userAgent: "",
  forwardedFor: "203.0.113.7",
};

const { previewMock, limitMock } = vi.hoisted(() => ({
  previewMock: vi.fn(),
  limitMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({
    "user-agent": state.userAgent,
    "x-forwarded-for": state.forwardedFor,
  }),
  cookies: async () => ({
    get: (name: string) =>
      state.cookies[name] ? { value: state.cookies[name] } : undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/server", () => ({
  connection: async () => {},
}));

vi.mock("./actions", () => ({
  submitInvitation: vi.fn(async () => ({ ok: true, role: "user" })),
}));

vi.mock("qrcode", () => ({
  default: { toString: vi.fn(async () => '<svg data-test="qr"></svg>') },
}));

vi.mock("@/lib/api/door", () => ({
  getInfra: async () => ({
    deps: { rateLimitStorage: { increment: limitMock } },
    auth: async () => ({ kind: "anon" }),
    settingsDeps: { db: { query: async () => ({ rows: [] }) } },
  }),
}));

vi.mock("@/lib/invite-preview", () => ({ loadInvitePreview: previewMock }));

vi.mock("@/lib/panel-settings", () => ({
  loadPanelSettings: async () => ({}),
  publicUrlFromSettings: () => "https://familia.test",
}));

vi.mock("@/lib/android-release", () => ({
  latestAndroidRelease: async () => ({ versionName: "0.18.2", versionCode: 1802 }),
}));

import InvitePage, { metadata } from "./page";

const PREVIEW = {
  state: "pending" as const,
  email: "ana@example.com",
  name: "Ana",
  role: "user" as const,
  role_applies: true,
  account_exists: false,
  locale: "en" as const,
  expires_at: "2026-11-24T12:00:00.000Z",
  inviter_name: "Eric",
  instance_name: "Familia Pérez",
  timezone: "Europe/Madrid",
};

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130 Safari/537.36";

function render(token = "027_inv_abc123") {
  return InvitePage({ params: Promise.resolve({ token }) }).then(renderToStaticMarkup);
}

beforeEach(() => {
  state.cookies = {};
  state.userAgent = ANDROID_UA;
  state.forwardedFor = "203.0.113.7";
  previewMock.mockReset();
  previewMock.mockResolvedValue(PREVIEW);
  limitMock.mockReset();
  limitMock.mockResolvedValue({ count: 1 });
});

describe("invite page", () => {
  it("uses the invitation locale, not the cookie", async () => {
    state.cookies = { "027_locale": "en" };
    previewMock.mockResolvedValue({ ...PREVIEW, locale: "es" });

    const html = await render();

    expect(html).toContain('lang="es"');
    expect(html).toContain("Acepta tu invitación");
    expect(previewMock).toHaveBeenCalledWith("027_inv_abc123");
  });

  it("shows the invitation details exactly once on the form step", async () => {
    const html = await render();

    // The card is read-only data the token already carries: a second copy (the
    // form used to render its own) duplicated the email and every row.
    expect(html.split("ana@example.com").length - 1).toBe(1);
    expect(html.split("grid-cols-1 gap-3 rounded-card").length - 1).toBe(1);
  });

  it("is not indexable and sends no referrer", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("rejects a malformed token without calling the preview", async () => {
    const html = await render("abc123");

    expect(html).not.toContain("<form");
    expect(html).toContain("This invitation link is not valid.");
    expect(previewMock).not.toHaveBeenCalled();
  });

  it("shows the generic card for an unknown or revoked token", async () => {
    previewMock.mockResolvedValue(null);

    const html = await render();

    expect(html).not.toContain("<form");
    expect(html).toContain("This invitation link is not valid.");
  });

  it("explains a used invitation and offers login", async () => {
    previewMock.mockResolvedValue({ ...PREVIEW, state: "used" });

    const html = await render();

    expect(html).toContain("This invitation has already been used.");
    expect(html).toContain('href="/login"');
    expect(html).not.toContain("<form");
  });

  it("explains an expired invitation", async () => {
    previewMock.mockResolvedValue({ ...PREVIEW, state: "expired" });

    const html = await render();

    expect(html).toContain("This invitation has expired. Ask an administrator for a new one.");
    expect(html).not.toContain("<form");
  });

  it("answers a rate-limited visit with a retry card, not an error", async () => {
    limitMock.mockResolvedValue({ count: 61 });

    const html = await render();

    expect(html).toContain("Too many attempts. Wait a minute and try again.");
    expect(previewMock).not.toHaveBeenCalled();
  });

  it("offers app, download and browser on Android without a QR", async () => {
    const html = await render();

    expect(html).toContain("The app is Android only (8+).");
    expect(html).toContain("Open in the app");
    expect(html).toContain("Download for Android");
    expect(html).toContain("Continue in the browser");
    expect(html).not.toContain("Open it on your phone");
    expect(html).not.toContain('data-test="qr"');
  });

  it("offers only the browser on iPhone", async () => {
    state.userAgent = IPHONE_UA;

    const html = await render();

    expect(html).toContain("The app is Android only.");
    expect(html).toContain("On iPhone you can accept the invitation here, in the browser.");
    expect(html).toContain("Continue in the browser");
    expect(html).not.toContain("Download for Android");
  });

  it("shows the form and a locally generated QR on desktop", async () => {
    state.userAgent = DESKTOP_UA;

    const html = await render();

    expect(html).toContain("Open it on your phone");
    expect(html).toContain('data-test="qr"');
    expect(html).toContain("<form");
    expect(html).toContain("You can also accept in this browser");
  });

  it("never paints the token on the page", async () => {
    const token = "027_inv_secretvalue123";

    const html = await render(token);

    expect(html).not.toContain(token);
  });
});
