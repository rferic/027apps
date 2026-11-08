import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@027apps/i18n/dictionary.js";

const resetOnRoute = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/instance",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/use-reset-on-route", () => ({
  useResetOnRouteChange: resetOnRoute,
}));

import { SettingField, SettingsForm, SaveError } from "./settings-form";
import type { SettingRow, SettingsCategoryRow } from "@/lib/setting-types";

const NAME: SettingRow = {
  key: "instance.name",
  category: "instance",
  label: "Instance name",
  help: "Public name of this 027Apps instance.",
  type: "string",
  isSecret: false,
  isPublic: true,
  superAdminOnly: false,
  readOnly: false,
  sortOrder: 10,
  updatedBy: null,
  updatedAt: "2026-11-01T10:00:00.000Z",
  value: "027Apps",
};

const JWT: SettingRow = {
  key: "security.jwt_expiry",
  category: "security",
  label: "JWT expiry (s)",
  help: "Supabase access token lifetime, reflected (read-only).",
  type: "int",
  isSecret: false,
  isPublic: false,
  superAdminOnly: true,
  readOnly: true,
  sortOrder: 10,
  updatedBy: null,
  updatedAt: "2026-11-01T10:00:00.000Z",
  value: 900,
};

const SECRET: SettingRow = {
  key: "notifications.push.fcm_service_account",
  category: "notifications",
  label: "FCM service account",
  help: "Service account JSON used to sign pushes (secret).",
  type: "json",
  isSecret: true,
  isPublic: false,
  superAdminOnly: false,
  readOnly: false,
  sortOrder: 60,
  updatedBy: null,
  updatedAt: "2026-11-01T10:00:00.000Z",
  // Deliberately invalid: a secret with a value must still never reach the UI.
  value: "leaked-secret",
  configured: true,
};

const LOCALES: SettingRow = {
  key: "localization.enabled_locales",
  category: "localization",
  label: "Enabled locales",
  help: "Subset of the 9 supported locales; en cannot be removed.",
  type: "locales",
  isSecret: false,
  isPublic: true,
  superAdminOnly: false,
  readOnly: false,
  sortOrder: 40,
  updatedBy: null,
  updatedAt: "2026-11-01T10:00:00.000Z",
  value: ["en", "es"],
};

const CATEGORIES: SettingsCategoryRow[] = [
  {
    categoryKey: "instance",
    label: "Instance",
    help: "Instance identity and public links.",
    icon: "server",
    sortOrder: 10,
    settings: [NAME],
  },
  {
    categoryKey: "localization",
    label: "Localization",
    help: "Languages, timezone and currency.",
    icon: "globe",
    sortOrder: 20,
    settings: [LOCALES],
  },
  {
    categoryKey: "security",
    label: "Security",
    help: "JWT, CORS and other security-relevant values.",
    icon: "shield",
    sortOrder: 30,
    settings: [JWT],
  },
  {
    categoryKey: "notifications",
    label: "Notifications",
    help: "Push notification provider (FCM).",
    icon: "bell",
    sortOrder: 40,
    settings: [SECRET],
  },
];

describe("SettingsForm", () => {
  it("re-seeds the draft from the server settings when the route is shown again", () => {
    resetOnRoute.mockClear();

    renderToStaticMarkup(
      <SettingsForm categories={CATEGORIES} restricted={[]} messages={{}} />,
    );

    const [seed, reset] = resetOnRoute.mock.calls[0] ?? [];
    // The hook gets the payload this render was seeded from, not a stale copy.
    expect(seed).toEqual([NAME, LOCALES, JWT, SECRET]);
    expect(typeof reset).toBe("function");
  });

  it("groups settings by category with the catalog label and help", () => {
    const html = renderToStaticMarkup(
      <SettingsForm categories={CATEGORIES} restricted={[]} messages={{}} />,
    );

    expect(html).toContain("Instance");
    expect(html).toContain("Instance name");
    expect(html).toContain("Public name of this 027Apps instance.");
    expect(html).toContain("Localization");
    expect(html).toContain("Notifications");
    expect(html).toContain("Save changes");
  });

  it("translates the catalog labels and help that arrive from the API", () => {
    const html = renderToStaticMarkup(
      <SettingsForm categories={CATEGORIES} restricted={[]} messages={getDictionary("it")} />,
    );

    expect(html).toContain("Istanza");
    expect(html).toContain("Nome istanza");
    expect(html).toContain("Nome pubblico di questa istanza di 027Apps.");
    expect(html).not.toContain(">Instance name<");
    expect(html).not.toContain("Instance identity and public links.");
  });

  it("keeps the API text for a key that is not in the catalog", () => {
    const html = renderToStaticMarkup(
      <SettingField
        setting={{ ...NAME, key: "custom.key", label: "API label", help: "API help" }}
        draft={{ "custom.key": "value" }}
        onChange={() => {}}
        error={null}
        messages={getDictionary("it")}
      />,
    );

    expect(html).toContain("API label");
    expect(html).toContain("API help");
  });

  it("shows only configured for a secret and never renders its value", () => {
    const html = renderToStaticMarkup(
      <SettingsForm categories={CATEGORIES} restricted={[]} messages={{}} />,
    );

    expect(html).toContain("Configured");
    expect(html).toContain("Leave empty to keep the current value.");
    expect(html).toContain("The saved secret is never shown.");
    expect(html).toContain('autoComplete="off"');
    expect(html).not.toContain("leaked-secret");
  });

  it("renders a read-only value with its reason instead of an input", () => {
    const html = renderToStaticMarkup(
      <SettingsForm categories={CATEGORIES} restricted={[]} messages={{}} />,
    );

    expect(html).toContain("This value is read-only.");
    expect(html).toContain("Supabase access token lifetime, reflected (read-only).");
    expect(html).not.toContain('id="setting-security-jwt_expiry"');
  });

  it("never renders an input for a super-admin-only setting hidden from an admin", () => {
    const html = renderToStaticMarkup(
      <SettingsForm
        categories={CATEGORIES}
        restricted={[
          {
            key: "instance.public_url",
            category: "instance",
            label: "Public URL",
            help: "https origin used for invitation links and deep links.",
            readOnly: false,
          },
        ]}
        messages={{}}
      />,
    );

    expect(html).toContain("Public URL");
    expect(html).toContain("Only a super administrator can view this value.");
    expect(html).not.toContain('id="setting-instance-public_url"');
  });

  it("marks the field named by details.key and no other field", () => {
    const error = {
      ok: false as const,
      code: "validation_failed",
      details: { key: "localization.timezone", formErrors: ["not a valid IANA timezone"] },
    };

    const matching = renderToStaticMarkup(
      <SettingField
        setting={{ ...NAME, key: "localization.timezone", label: "Timezone" }}
        draft={{ "localization.timezone": "Mars/Base" }}
        onChange={() => {}}
        error={error}
        messages={{}}
      />,
    );
    const other = renderToStaticMarkup(
      <SettingField
        setting={{ ...NAME, key: "instance.name" }}
        draft={{ "instance.name": "027Apps" }}
        onChange={() => {}}
        error={error}
        messages={{}}
      />,
    );

    expect(matching).toContain("not a valid IANA timezone");
    expect(other).not.toContain("not a valid IANA timezone");
  });

  it("renders enabled locales as combobox chips with English fixed", () => {
    const html = renderToStaticMarkup(
      <SettingField
        setting={LOCALES}
        draft={{ "localization.enabled_locales": "en, es" }}
        onChange={() => {}}
        error={null}
        messages={{}}
      />,
    );

    expect(html).toContain('role="combobox"');
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain('data-fixed="true"');
    expect(html).toContain("English");
    expect(html).toContain("Español");
    expect(html).not.toContain('data-remove="en"');
    expect(html).toContain('data-remove="es"');
  });

  it("shows the coherence error in the alert with its request id", () => {
    const html = renderToStaticMarkup(
      <SaveError
        error={{
          ok: false,
          code: "validation_failed",
          requestId: "req-coherence",
          details: {
            formErrors: ["default_locale must be in enabled_locales"],
            fieldErrors: {},
          },
        }}
        messages={{}}
      />,
    );

    expect(html).toContain("default_locale must be in enabled_locales");
    expect(html).toContain("Request ID");
    expect(html).toContain("req-coherence");
  });
});
