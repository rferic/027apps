"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { backToSmtpAction } from "./actions";

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
  values: PreferencesValues;
  /** Current instance logo (public setting) for the header preview. */
  logoUrl?: string | null;
  locales: readonly string[];
  /** Locales already enabled on the instance (`en` can never be removed). */
  enabledLocales: readonly string[];
  timezones: readonly string[];
  currencies: readonly string[];
}

const FIELDS: Record<string, string> = {
  "instance.name": "We couldn't save the instance name.",
  "instance.public_url": "Enter the public HTTPS URL (no trailing slash).",
  "localization.default_locale": "Choose one of the supported languages.",
  "localization.enabled_locales": "We couldn't enable that language.",
  "localization.timezone": "Choose a valid IANA time zone.",
  "localization.default_currency": "Choose an enabled currency.",
  "notifications.push.provider":
    "Firebase needs the four client values and the service account before it can be enabled.",
  "notifications.push.fcm_service_account": "The service account must be the JSON key file from Firebase.",
};

const NETWORK_ERROR = "We couldn't reach the server. Check the connection, then try again.";

async function patchSetting(key: string, value: unknown): Promise<string | null> {
  const res = await fetch(`/api/v1/settings/${key.replace(".", "/")}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (res.ok) return null;
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? "Save failed";
}

/**
 * Setup steps 4 and 5: preferences (required — this is what clears
 * `setup_incomplete`) and optional FCM notifications. Everything is written
 * through `/api/v1/settings`, so the super_admin session is the audit actor.
 */

type StepsResult = { steps: Array<[string, unknown]> } | { error: string };

/** Ordered writes for steps 4–5; the provider goes last (FCM needs all keys). */
function buildSteps(form: PreferencesValues, enabledLocales: readonly string[]): StepsResult {
  const steps: Array<[string, unknown]> = [];
  // The default locale must be enabled first (`enabled_locales` ⊆ supported).
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
        return { error: "The service account must be the JSON key file, copied whole." };
      }
      steps.push(["notifications.push.fcm_service_account", serviceAccount]);
    } else if (!form.fcmServiceAccountConfigured) {
      return {
        error:
          "Paste the service account JSON (Firebase → Project settings → Service accounts → Generate new private key).",
      };
    }
  }

  steps.push(["notifications.push.provider", form.pushProvider]);
  return { steps };
}

export function PreferencesStep({
  values,
  logoUrl,
  locales,
  enabledLocales,
  timezones,
  currencies,
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

    const built = buildSteps(form, enabledLocales);
    if ("error" in built) {
      setError(built.error);
      setSaving(false);
      return;
    }

    try {
      for (const [key, value] of built.steps) {
        const failure = await patchSetting(key, value);
        if (failure) {
          setError(`${FIELDS[key] ?? "Save failed"} (${key})`);
          setSaving(false);
          return;
        }
      }
    } catch {
      setError(NETWORK_ERROR);
      setSaving(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <form action={backToSmtpAction}>
        <Button type="submit" variant="secondary">
          ← Back to step 3 (email test)
        </Button>
      </form>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-card border border-border bg-surface p-6"
      >
        <div className="mb-3 flex justify-center">
          <BrandLogo logoUrl={logoUrl} size="lg" />
        </div>
        <h2 className="text-sm font-semibold">Step 4 · Preferences</h2>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          These values are required to finish the installation. You can change them later in
          settings. Step 5 (notifications) is optional and lives at the bottom of this form.
        </p>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Instance name</span>
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
          <span className="text-sm font-medium">Public URL</span>
          <input
            type="url"
            value={form.publicUrl}
            onChange={(event) => update("publicUrl", event.target.value)}
            placeholder="https://panel.example.com"
            pattern={"https://[^\\/\\s]+"}
            required
            className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <span className="text-xs text-muted-foreground">
            Used for invitations and deep links. HTTPS, no trailing slash.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Default language</span>
          <select
            value={form.locale}
            onChange={(event) => update("locale", event.target.value)}
            className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
          >
            {locales.map((locale) => (
              <option key={locale} value={locale}>
                {locale}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Time zone</span>
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
          <span className="text-sm font-medium">Default currency</span>
          <select
            value={form.currency}
            onChange={(event) => update("currency", event.target.value)}
            className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="mt-2 flex flex-col gap-3 border-t border-border pt-3">
          <legend className="text-sm font-semibold">Step 5 · Notifications (optional)</legend>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Provider</span>
            <select
              value={form.pushProvider}
              onChange={(event) => update("pushProvider", event.target.value as "none" | "fcm")}
              className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
            >
              <option value="none">None for now</option>
              <option value="fcm">Firebase Cloud Messaging</option>
            </select>
          </label>

          {form.pushProvider === "fcm" && (
            <>
              <input
                type="text"
                value={form.fcmProjectId}
                onChange={(event) => update("fcmProjectId", event.target.value)}
                placeholder="Project ID"
                aria-label="FCM project id"
                required
                className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <input
                type="text"
                value={form.fcmAppId}
                onChange={(event) => update("fcmAppId", event.target.value)}
                placeholder="App ID"
                aria-label="FCM app id"
                required
                className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <input
                type="text"
                value={form.fcmApiKey}
                onChange={(event) => update("fcmApiKey", event.target.value)}
                placeholder="Web API key (AIza…)"
                aria-label="FCM web API key"
                required
                className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <input
                type="text"
                value={form.fcmSenderId}
                onChange={(event) => update("fcmSenderId", event.target.value)}
                placeholder="Sender ID"
                aria-label="FCM sender id"
                required
                className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Service account JSON</span>
                <textarea
                  value={form.fcmServiceAccount}
                  onChange={(event) => update("fcmServiceAccount", event.target.value)}
                  placeholder='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----..."}'
                  rows={3}
                  aria-label="FCM service account JSON"
                  className="rounded-control border border-border bg-background px-2.5 py-1.5 font-mono text-xs"
                />
                <span className="text-xs text-muted-foreground">
                  Firebase → Project settings → Service accounts → Generate new private key. Stored
                  encrypted and never shown again
                  {form.fcmServiceAccountConfigured ? " (one is already configured)." : "."}
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
          {saving ? "Finishing…" : "Finish installation"}
        </Button>
      </div>
      </form>
    </div>
  );
}
