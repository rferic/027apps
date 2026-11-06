import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import {
  PreferencesStep,
  buildSteps,
  patchSettings,
  type PreferencesValues,
} from "./preferences-step";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

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
};

const FCM_VALUES: PreferencesValues = {
  ...VALUES,
  instanceName: "Test",
  publicUrl: "https://test.example.com",
  locale: "es",
  pushProvider: "fcm",
  fcmProjectId: "my-project",
  fcmAppId: "1:123:web:abc",
  fcmApiKey: "AIzaSy...",
  fcmSenderId: "123",
  fcmServiceAccount: JSON.stringify({
    type: "service_account",
    project_id: "my-project",
    private_key: "-----BEGIN PRIVATE KEY-----",
    client_email: "x@y.iam.gserviceaccount.com",
    token_uri: "https://oauth2.googleapis.com/token",
    client_id: "123",
  }),
  fcmServiceAccountConfigured: false,
};

function render(
  values: Partial<PreferencesValues> = {},
  messages: TranslationMap = {},
  helpHref = "/help/firebase?lang=en",
): string {
  return renderToStaticMarkup(
    <PreferencesStep
      values={{ ...VALUES, ...values }}
      locales={["en", "es"]}
      enabledLocales={["en"]}
      timezones={["UTC", "Europe/Madrid"]}
      currencies={["EUR", "USD"]}
      messages={messages}
      helpHref={helpHref}
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

describe("PreferencesStep — localization and Firebase help", () => {
  it("renders Spanish strings and a localized external help link", () => {
    const html = render(
      { locale: "es" },
      getDictionary("es"),
      "/help/firebase?lang=es",
    );

    expect(html).toContain("Paso 4 · Preferencias");
    expect(html).toContain("Finalizar instalación");
    expect(html).toContain('href="/help/firebase?lang=es"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

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

describe("PreferencesStep — batch save", () => {
  it("sends a single PATCH /api/v1/settings with all 12 wizard updates", async () => {
    const fetchSpy = vi.fn<FetchLike>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ settings: [] }),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const built = buildSteps(FCM_VALUES, ["en"], getDictionary("en"));
    if ("error" in built) throw new Error(built.error);
    expect(built.steps).toHaveLength(12);

    const failure = await patchSettings(built.steps, getDictionary("en"));

    expect(failure).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/v1/settings");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({
      updates: built.steps.map(([key, value]) => ({ key, value })),
    });
  });

  it("maps error.details.key to the field message and the server detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: "validation_failed",
            message: "Validation failed",
            details: { key: "instance.name" },
          },
        }),
      })),
    );

    const built = buildSteps(FCM_VALUES, ["en"], {});
    if ("error" in built) throw new Error(built.error);

    const failure = await patchSettings(built.steps, {});

    expect(failure).toContain("We couldn't save the instance name.");
    expect(failure).toContain("(instance.name)");
    expect(failure).toContain("Details: Validation failed");
  });
});
