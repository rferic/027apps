"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { isSupportedLocale, localeCookie } from "@/lib/locale";

export interface PreferencesValues {
  instanceName: string;
  publicUrl: string;
  locale: string;
  timezone: string;
  currency: string;
  pushProvider: "none" | "fcm";
  fcmProjectId: string;
  fcmAppId: string;
  fcmApiKey: string;
  fcmSenderId: string;
  /** Paste of the service account JSON; empty means "keep the configured one". */
  fcmServiceAccount: string;
  fcmServiceAccountConfigured: boolean;
}

export interface PreferencesProps {
  /** The signed-in super_admin whose profile mirrors the chosen locale/timezone. */
  userId: string;
  values: PreferencesValues;
  locales: readonly string[];
  /** Locales already enabled on the instance (`en` can never be removed). */
  enabledLocales: readonly string[];
  timezones: readonly string[];
  currencies: readonly string[];
  messages: TranslationMap;
  helpHref: string;
}

function fieldMessage(key: string, messages: TranslationMap): string {
  switch (key) {
    case "instance.name":
      return t("We couldn't save the instance name.", messages);
    case "instance.public_url":
      return t("Enter the public URL (no trailing slash).", messages);
    case "localization.default_locale":
      return t("Choose one of the supported languages.", messages);
    case "localization.enabled_locales":
      return t("We couldn't enable that language.", messages);
    case "localization.timezone":
      return t("Choose a valid IANA time zone.", messages);
    case "localization.default_currency":
      return t("Choose an enabled currency.", messages);
    case "notifications.push.provider":
      return t(
        "Firebase needs the four client values and the service account before it can be enabled.",
        messages,
      );
    case "notifications.push.fcm_service_account":
      return t("The service account must be the JSON key file from Firebase.", messages);
    default:
      return t("Save failed", messages);
  }
}

/**
 * Sends every wizard update in a single PATCH. Returns the message to show, or
 * `null` on success; the failing key comes from `error.details.key`.
 */
export async function patchSettings(
  updates: ReadonlyArray<readonly [string, unknown]>,
  messages: TranslationMap,
): Promise<string | null> {
  const res = await fetch(`/api/v1/settings`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ updates: updates.map(([key, value]) => ({ key, value })) }),
  });
  if (res.ok) return null;

  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string; details?: { key?: string } };
  } | null;
  const detail = t("Details: {message}", messages, {
    message: body?.error?.message ?? "Save failed",
  });
  const key = body?.error?.details?.key;
  if (!key) return `${t("Save failed", messages)} ${detail}`;
  return `${fieldMessage(key, messages)} (${key}) ${detail}`;
}

/**
 * The wizard writes the chosen language and zone to the instance settings, but
 * the admin's own profile keeps its seeded `en`/`UTC` until this call. It is
 * best-effort on purpose: the settings batch already cleared `setup_incomplete`,
 * so a failure here must not block the installation (the profile stays editable
 * from /members afterwards). No console output by design.
 */
export async function patchUserPreferences(
  userId: string,
  values: Pick<PreferencesValues, "locale" | "timezone">,
): Promise<void> {
  try {
    await fetch(`/api/v1/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ locale: values.locale, timezone: values.timezone }),
    });
  } catch {
    // Best-effort: the installation is already complete at this point.
  }
}

/**
 * Steps 4–5 in order: the settings batch first (it completes setup), then the
 * profile mirror. Returns the message to show, or `null` on success.
 */
export async function savePreferences(
  userId: string,
  form: PreferencesValues,
  enabledLocales: readonly string[],
  messages: TranslationMap,
): Promise<string | null> {
  const built = buildSteps(form, enabledLocales, messages);
  if ("error" in built) return built.error;

  try {
    const failure = await patchSettings(built.steps, messages);
    if (failure) return failure;
  } catch {
    return t("We couldn't reach the server. Check the connection, then try again.", messages);
  }

  await patchUserPreferences(userId, { locale: form.locale, timezone: form.timezone });

  // The panel picks its language from this cookie on the next request, before
  // the profile mirror is visible there: write it as soon as the save is done.
  if (typeof document !== "undefined" && isSupportedLocale(form.locale)) {
    document.cookie = localeCookie(form.locale);
  }
  return null;
}

type StepsResult = { steps: Array<[string, unknown]> } | { error: string };

/**
 * Setup steps 4 and 5: preferences (required — this is what clears
 * `setup_incomplete`) and optional FCM notifications. Everything is written
 * through `/api/v1/settings`, so the super_admin session is the audit actor.
 */

/** Writes for steps 4–5; order does not matter because coherence sees the merged batch. */
export function buildSteps(
  form: PreferencesValues,
  enabledLocales: readonly string[],
  messages: TranslationMap,
): StepsResult {
  const steps: Array<[string, unknown]> = [];
  // The default locale must be enabled, so add it to the same batch when missing.
  if (!enabledLocales.includes(form.locale)) {
    steps.push(["localization.enabled_locales", [...enabledLocales, form.locale]]);
  }
  steps.push(
    ["instance.name", form.instanceName],
    ["instance.public_url", form.publicUrl],
    ["localization.default_locale", form.locale],
    ["localization.timezone", form.timezone],
    ["localization.default_currency", form.currency],
  );

  if (form.pushProvider === "fcm") {
    steps.push(
      ["notifications.push.fcm_project_id", form.fcmProjectId],
      ["notifications.push.fcm_app_id", form.fcmAppId],
      ["notifications.push.fcm_api_key", form.fcmApiKey],
      ["notifications.push.fcm_sender_id", form.fcmSenderId],
    );
    const serviceAccount = form.fcmServiceAccount.trim();
    if (serviceAccount) {
      try {
        JSON.parse(serviceAccount);
      } catch {
        return {
          error: t("The service account must be the JSON key file, copied whole.", messages),
        };
      }
      steps.push(["notifications.push.fcm_service_account", serviceAccount]);
    } else if (!form.fcmServiceAccountConfigured) {
      return {
        error: t(
          "Paste the service account JSON (Firebase → Project settings → Service accounts → Generate new private key).",
          messages,
        ),
      };
    }
  }

  steps.push(["notifications.push.provider", form.pushProvider]);
  return { steps };
}

export function PreferencesStep({
  userId,
  values,
  locales,
  enabledLocales,
  timezones,
  currencies,
  messages,
  helpHref,
}: PreferencesProps) {
  const router = useRouter();
  const [form, setForm] = useState(values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof PreferencesValues>(key: K, value: PreferencesValues[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const failure = await savePreferences(userId, form, enabledLocales, messages);
    if (failure) {
      setError(failure);
      setSaving(false);
      return;
    }

    router.push("/panel");
    router.refresh();
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-card border border-border bg-surface p-6"
    >
      <h2 className="text-sm font-semibold">{t("Step 4 · Preferences", messages)}</h2>
      <p className="mt-1 mb-4 text-xs text-muted-foreground">
        {t("These values are required to finish the installation.", messages)}{" "}
        {t(
          "You can change them later in settings. Step 5 (notifications) is optional and lives at the bottom of this form.",
          messages,
        )}
      </p>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("Instance name", messages)}</span>
          <input
            type="text"
            value={form.instanceName}
            onChange={(event) => update("instanceName", event.target.value)}
            maxLength={80}
            required
            className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("Public URL", messages)}</span>
          <input
            type="url"
            value={form.publicUrl}
            onChange={(event) => update("publicUrl", event.target.value)}
            placeholder="https://panel.example.com"
            pattern={"https?://[^\\/\\s]+"}
            required
            className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <span className="text-xs text-muted-foreground">
            {t(
              "Used for invitations and deep links. HTTPS, or HTTP only for local addresses (localhost, *.local, *.test, private IPs). No trailing slash. Use a stable address, not a per-deployment preview URL.",
              messages,
            )}
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("Default language", messages)}</span>
          <Select
            value={form.locale}
            onChange={(event) => update("locale", event.target.value)}
          >
            {locales.map((locale) => (
              <option key={locale} value={locale}>
                {locale}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("Time zone", messages)}</span>
          <input
            type="text"
            list="setup-timezones"
            value={form.timezone}
            onChange={(event) => update("timezone", event.target.value)}
            required
            className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <datalist id="setup-timezones">
            {timezones.map((timezone) => (
              <option key={timezone} value={timezone} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("Default currency", messages)}</span>
          <Select
            value={form.currency}
            onChange={(event) => update("currency", event.target.value)}
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </label>

        <fieldset className="mt-2 flex flex-col gap-3 border-t border-border pt-3">
          <legend className="text-sm font-semibold">
            {t("Step 5 · Notifications (optional)", messages)}{" "}
            <a
              href={helpHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-normal text-accent underline"
            >
              {t("Firebase setup help", messages)}
            </a>
          </legend>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("Provider", messages)}</span>
            <Select
              value={form.pushProvider}
              onChange={(event) => update("pushProvider", event.target.value as "none" | "fcm")}
            >
              <option value="none">{t("None for now", messages)}</option>
              <option value="fcm">{t("Firebase Cloud Messaging", messages)}</option>
            </Select>
          </label>

          {form.pushProvider === "fcm" && (
            <>
              <input
                type="text"
                value={form.fcmProjectId}
                onChange={(event) => update("fcmProjectId", event.target.value)}
                placeholder={t("Project ID", messages)}
                aria-label={t("FCM project id", messages)}
                required
                className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <input
                type="text"
                value={form.fcmAppId}
                onChange={(event) => update("fcmAppId", event.target.value)}
                placeholder={t("App ID", messages)}
                aria-label={t("FCM app id", messages)}
                required
                className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <input
                type="text"
                value={form.fcmApiKey}
                onChange={(event) => update("fcmApiKey", event.target.value)}
                placeholder={t("Web API key (AIza…)", messages)}
                aria-label={t("FCM web API key", messages)}
                required
                className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <input
                type="text"
                value={form.fcmSenderId}
                onChange={(event) => update("fcmSenderId", event.target.value)}
                placeholder={t("Sender ID", messages)}
                aria-label={t("FCM sender id", messages)}
                required
                className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{t("Service account JSON", messages)}</span>
                <textarea
                  value={form.fcmServiceAccount}
                  onChange={(event) => update("fcmServiceAccount", event.target.value)}
                  placeholder='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----..."}'
                  rows={3}
                  aria-label={t("FCM service account JSON", messages)}
                  className="rounded-control border border-border bg-background px-2.5 py-1.5 font-mono text-xs"
                />
                <span className="text-xs text-muted-foreground">
                  {t(
                    "Firebase → Project settings → Service accounts → Generate new private key. Stored encrypted and never shown again.",
                    messages,
                  )}{" "}
                  {form.fcmServiceAccountConfigured
                    ? t("One service account is already configured.", messages)
                    : ""}
                </span>
              </label>
            </>
          )}
        </fieldset>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4">
        <Button type="submit" disabled={saving}>
          {saving ? t("Finishing…", messages) : t("Finish installation", messages)}
        </Button>
      </div>
    </form>
  );
}
