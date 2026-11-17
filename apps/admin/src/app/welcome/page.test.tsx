import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import WelcomePage, { metadata } from "./page";

function render(notice?: string) {
  return WelcomePage({ searchParams: Promise.resolve(notice ? { notice } : {}) }).then(
    renderToStaticMarkup,
  );
}

describe("welcome page", () => {
  it("confirms the account and offers the app and login", async () => {
    const html = await render();

    expect(html).toContain("Your account is ready");
    expect(html).toContain("This web panel is only for administrators.");
    expect(html).toContain('href="/download/android"');
    expect(html).toContain('href="/login"');
  });

  it("explains a failed automatic sign-in without losing the account", async () => {
    const html = await render("signin_failed");

    expect(html).toContain('role="alert"');
    expect(html).toContain("The account was created, but the automatic sign-in did not work.");
  });

  it("is not indexable", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
