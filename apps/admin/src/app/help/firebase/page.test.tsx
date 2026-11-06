import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieValues = { current: {} as Record<string, string> };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieValues.current[name] ? { value: cookieValues.current[name] } : undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import HelpPage from "./page";

beforeEach(() => {
  cookieValues.current = {};
});

describe("Firebase help page", () => {
  it("renders the public guide with its language selector and safe external link", async () => {
    const html = renderToStaticMarkup(
      await HelpPage({ searchParams: Promise.resolve({ lang: "es" }) }),
    );

    expect(html).toContain('lang="es"');
    expect(html).toContain("Configurar Firebase Cloud Messaging");
    expect(html.match(/<option/g)).toHaveLength(9);
    expect(html).toContain('<option value="es" selected="">Español</option>');
    expect(html).toContain('href="https://console.firebase.google.com/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("falls back to English without reflecting a hostile query", async () => {
    const hostile = "<script>alert(1)</script>";
    const html = renderToStaticMarkup(
      await HelpPage({ searchParams: Promise.resolve({ lang: hostile }) }),
    );

    expect(html).toContain('lang="en"');
    expect(html).not.toContain(hostile);
  });
});
