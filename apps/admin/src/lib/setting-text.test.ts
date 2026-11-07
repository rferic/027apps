import { describe, expect, it } from "vitest";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import { SETTINGS_CATALOG, SETTINGS_CATEGORIES } from "@027apps/core/settings/catalog.js";
import { categoryHelp, categoryLabel, settingHelp, settingLabel } from "./setting-text";

const italian = getDictionary("it");

describe("catalog parity", () => {
  it("uses the exact catalog text as the English key (fallback and translation base)", () => {
    for (const meta of SETTINGS_CATALOG) {
      expect(settingLabel(meta.key, {})).toBe(meta.label);
      expect(settingHelp(meta.key, {})).toBe(meta.help);
    }
    for (const category of SETTINGS_CATEGORIES) {
      expect(categoryLabel(category.categoryKey, {})).toBe(category.label);
      expect(categoryHelp(category.categoryKey, {})).toBe(category.help);
    }
  });
});

describe("settingLabel", () => {
  it("translates a catalog key with the panel dictionary", () => {
    expect(settingLabel("instance.name", italian)).toBe("Nome istanza");
  });

  it("translates every setting key in the catalog", () => {
    const keys = [
      "instance.name",
      "instance.public_url",
      "localization.default_locale",
      "localization.timezone",
      "localization.default_currency",
      "localization.enabled_locales",
      "security.jwt_expiry",
      "security.cors_allowlist",
      "notifications.push.provider",
      "notifications.push.fcm_project_id",
      "notifications.push.fcm_app_id",
      "notifications.push.fcm_api_key",
      "notifications.push.fcm_sender_id",
      "notifications.push.fcm_service_account",
      "rate_limit.mobile_per_min",
      "rate_limit.api_key_per_min",
      "rate_limit.write_per_min",
      "rate_limit.public_per_min",
    ];

    for (const key of keys) {
      expect(settingLabel(key, {})).not.toBe(key);
    }
  });

  it("falls back to the API label for a key outside the catalog", () => {
    expect(settingLabel("custom.key", italian, "API label")).toBe("API label");
  });

  it("falls back to the key when neither the catalog nor the API has text", () => {
    expect(settingLabel("custom.key", italian)).toBe("custom.key");
  });
});

describe("settingHelp", () => {
  it("translates the catalog help text", () => {
    expect(settingHelp("instance.name", italian)).toBe(
      "Nome pubblico di questa istanza di 027Apps.",
    );
  });

  it("falls back to the API help text", () => {
    expect(settingHelp("custom.key", italian, "API help")).toBe("API help");
  });
});

describe("categoryLabel", () => {
  it("translates the five catalog categories", () => {
    expect(categoryLabel("instance", italian)).toBe("Istanza");
    expect(categoryLabel("localization", italian)).toBe("Localizzazione");
    expect(categoryLabel("security", italian)).toBe("Sicurezza");
    expect(categoryLabel("notifications", italian)).toBe("Notifiche");
    expect(categoryLabel("rate_limit", italian)).toBe("Limiti di richieste");
  });

  it("falls back to the API label for an unknown category", () => {
    expect(categoryLabel("billing", italian, "Billing")).toBe("Billing");
  });
});

describe("categoryHelp", () => {
  it("translates the category help", () => {
    expect(categoryHelp("security", italian)).toBe(
      "JWT, CORS e altri valori rilevanti per la sicurezza.",
    );
  });

  it("falls back to the API help for an unknown category", () => {
    expect(categoryHelp("billing", italian, "API help")).toBe("API help");
  });
});
