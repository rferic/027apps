import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PreferencesStep, type PreferencesValues } from "./preferences-step";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const VALUES: PreferencesValues = {
  instanceName: "027Apps",
  publicUrl: "",
  locale: "en",
  timezone: "UTC",
  currency: "EUR",
  pushProvider: "none",
  fcmProjectId: "",
  fcmAppId: "",
  fcmApiKey: "",
  fcmSenderId: "",
  fcmServiceAccount: "",
  fcmServiceAccountConfigured: false,
  logoUrl: "",
};

function render(values: Partial<PreferencesValues> = {}): string {
  return renderToStaticMarkup(
    <PreferencesStep
      values={{ ...VALUES, ...values }}
      locales={["en", "es"]}
      enabledLocales={["en"]}
      timezones={["UTC", "Europe/Madrid"]}
      currencies={["EUR", "USD"]}
    />,
  );
}

/** The `pattern` attribute as the browser receives it (anchored, `v` flag). */
function publicUrlPattern(): RegExp {
  const html = render();
  const match = html.match(/pattern="([^"]*)"/);
  if (!match?.[1]) throw new Error("Public URL input has no pattern");
  return new RegExp(`^(?:${match[1]})$`, "v");
}

describe("PreferencesStep — Public URL validation", () => {
  it("accepts an HTTPS tunnel URL without a path", () => {
    expect(publicUrlPattern().test("https://pace-annotation-nut-dense.trycloudflare.com")).toBe(
      true,
    );
  });

  it("rejects a trailing slash", () => {
    expect(publicUrlPattern().test("https://example.com/")).toBe(false);
  });

  it("rejects a path after the host", () => {
    expect(publicUrlPattern().test("https://example.com/setup")).toBe(false);
  });

  it("rejects plain HTTP", () => {
    expect(publicUrlPattern().test("http://example.com")).toBe(false);
  });
});
