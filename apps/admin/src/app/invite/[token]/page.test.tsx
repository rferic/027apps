import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieValues = { current: {} as Record<string, string> };

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) =>
      cookieValues.current[name] ? { value: cookieValues.current[name] } : undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import InvitePage, { metadata } from "./page";

beforeEach(() => {
  cookieValues.current = {};
});

describe("invite page", () => {
  it("renders in the locale from the 027_locale cookie", async () => {
    cookieValues.current = { "027_locale": "es" };

    const html = renderToStaticMarkup(
      await InvitePage({ params: Promise.resolve({ token: "027_inv_abc123" }) }),
    );

    expect(html).toContain('lang="es"');
    expect(html).toContain("Acepta tu invitación");
  });

  it("falls back to English without the cookie", async () => {
    const html = renderToStaticMarkup(
      await InvitePage({ params: Promise.resolve({ token: "027_inv_abc123" }) }),
    );

    expect(html).toContain('lang="en"');
    expect(html).toContain("Accept your invitation");
  });

  it("is not indexable and sends no referrer", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("renders the form for a well-formed token", async () => {
    const html = renderToStaticMarkup(
      await InvitePage({ params: Promise.resolve({ token: "027_inv_abc123" }) }),
    );

    expect(html).toContain("<form");
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('name="confirmation"');
    expect(html).toContain("Accept invitation");
  });

  it("rejects a token without the prefix without rendering the form", async () => {
    const html = renderToStaticMarkup(
      await InvitePage({ params: Promise.resolve({ token: "abc123" }) }),
    );

    expect(html).not.toContain("<form");
    expect(html).toContain("This invitation link is not valid.");
  });

  it("rejects a token above the Core length limit", async () => {
    const html = renderToStaticMarkup(
      await InvitePage({ params: Promise.resolve({ token: `027_inv_${"a".repeat(193)}` }) }),
    );

    expect(html).not.toContain("<form");
    expect(html).toContain("This invitation link is not valid.");
  });

  it("never paints the token on the page", async () => {
    const token = "027_inv_secretvalue123";
    const html = renderToStaticMarkup(await InvitePage({ params: Promise.resolve({ token }) }));

    expect(html).not.toContain(token);
  });
});
