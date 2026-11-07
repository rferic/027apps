import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { SettingField, SettingsForm } from "./settings-form";
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
});
