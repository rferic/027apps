import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";

type Translator = (messages: TranslationMap) => string;

/**
 * Catalog metadata (`label`/`help`) travels from the Core as English API data,
 * not as UI copy: rendering it as-is leaves Settings in English on every
 * locale. These tables translate by canonical key with literal `t()` calls so
 * `i18n:scan` catalogues each string. An unknown key falls back to the API
 * text instead of inventing a label.
 */

/** One label per setting key in `packages/core/src/settings/catalog.ts`. */
const SETTING_LABELS: Record<string, Translator> = {
  "instance.name": (messages) => t("Instance name", messages),
  "instance.public_url": (messages) => t("Public URL", messages),
  "demo.enabled": (messages) => t("Demo data", messages),
  "localization.default_locale": (messages) => t("Default locale", messages),
  "localization.timezone": (messages) => t("Timezone", messages),
  "localization.default_currency": (messages) => t("Default currency", messages),
  "localization.enabled_locales": (messages) => t("Enabled locales", messages),
  "security.jwt_expiry": (messages) => t("JWT expiry (s)", messages),
  "security.cors_allowlist": (messages) => t("CORS allowlist", messages),
  "notifications.push.provider": (messages) => t("Push provider", messages),
  "notifications.push.fcm_project_id": (messages) => t("FCM project id", messages),
  "notifications.push.fcm_app_id": (messages) => t("FCM app id", messages),
  "notifications.push.fcm_api_key": (messages) => t("FCM API key", messages),
  "notifications.push.fcm_sender_id": (messages) => t("FCM sender id", messages),
  "notifications.push.fcm_service_account": (messages) => t("FCM service account", messages),
  "rate_limit.mobile_per_min": (messages) => t("Mobile per minute", messages),
  "rate_limit.api_key_per_min": (messages) => t("API key per minute", messages),
  "rate_limit.write_per_min": (messages) => t("Write per minute", messages),
  "rate_limit.public_per_min": (messages) => t("Public per minute", messages),
};

/** One help line per setting key in the same catalog. */
const SETTING_HELPS: Record<string, Translator> = {
  "instance.name": (messages) => t("Public name of this 027Apps instance.", messages),
  "instance.public_url": (messages) =>
    t("https origin used for invitation links and deep links.", messages),
  "demo.enabled": (messages) =>
    t(
      "Allow installing sample members, categories and module data. Refused in production unless ALLOW_DEMO_DATA=true.",
      messages,
    ),
  "localization.default_locale": (messages) =>
    t("Locale for users without a preference.", messages),
  "localization.timezone": (messages) =>
    t("IANA timezone for dates shown by the instance.", messages),
  "localization.default_currency": (messages) =>
    t("ISO 4217 code, must exist and be enabled.", messages),
  "localization.enabled_locales": (messages) =>
    t("Subset of the 9 supported locales; en cannot be removed.", messages),
  "security.jwt_expiry": (messages) =>
    t("Supabase access token lifetime, reflected (read-only).", messages),
  "security.cors_allowlist": (messages) =>
    t("Origins allowed by the API door (max 20, no wildcard, no paths).", messages),
  "notifications.push.provider": (messages) => t("fcm or none.", messages),
  "notifications.push.fcm_project_id": (messages) => t("Firebase project id.", messages),
  "notifications.push.fcm_app_id": (messages) => t("Firebase web app id.", messages),
  "notifications.push.fcm_api_key": (messages) =>
    t("Firebase web API key (client key, not a legacy server key).", messages),
  "notifications.push.fcm_sender_id": (messages) => t("Firebase sender id.", messages),
  "notifications.push.fcm_service_account": (messages) =>
    t("Service account JSON used to sign pushes (secret).", messages),
  "rate_limit.mobile_per_min": (messages) => t("Requests per minute from the mobile app.", messages),
  "rate_limit.api_key_per_min": (messages) => t("Requests per minute per service key.", messages),
  "rate_limit.write_per_min": (messages) => t("Write requests per minute.", messages),
  "rate_limit.public_per_min": (messages) => t("Requests per minute for public doors.", messages),
};

const CATEGORY_LABELS: Record<string, Translator> = {
  instance: (messages) => t("Instance", messages),
  localization: (messages) => t("Localization", messages),
  security: (messages) => t("Security", messages),
  notifications: (messages) => t("Notifications", messages),
  rate_limit: (messages) => t("Rate limits", messages),
};

const CATEGORY_HELPS: Record<string, Translator> = {
  instance: (messages) => t("Instance identity and public links.", messages),
  localization: (messages) => t("Languages, timezone and currency.", messages),
  security: (messages) => t("JWT, CORS and other security-relevant values.", messages),
  notifications: (messages) => t("Push notification provider (FCM).", messages),
  rate_limit: (messages) => t("Per-identity request limits (per minute).", messages),
};

export function settingLabel(
  key: string,
  messages: TranslationMap,
  fallback?: string,
): string {
  return SETTING_LABELS[key]?.(messages) ?? fallback ?? key;
}

export function settingHelp(
  key: string,
  messages: TranslationMap,
  fallback?: string,
): string {
  return SETTING_HELPS[key]?.(messages) ?? fallback ?? key;
}

export function categoryLabel(
  categoryKey: string,
  messages: TranslationMap,
  fallback?: string,
): string {
  return CATEGORY_LABELS[categoryKey]?.(messages) ?? fallback ?? categoryKey;
}

export function categoryHelp(
  categoryKey: string,
  messages: TranslationMap,
  fallback?: string,
): string {
  return CATEGORY_HELPS[categoryKey]?.(messages) ?? fallback ?? categoryKey;
}
