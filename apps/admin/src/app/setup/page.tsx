import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { EXPECTED_JWT_EXPIRY_SECONDS, jwtExpirySeconds } from "@027apps/core/auth/jwt.js";
import { hasActiveSuperAdmin, isSetupIncomplete } from "@027apps/core/instance/api.js";
import { SUPPORTED_LOCALES } from "@027apps/core/settings/catalog.js";
import {
  readPublicSettings,
  recordJwtExpiry,
  type SettingsDeps,
} from "@027apps/core/settings/service.js";
import type { JsonValue } from "@027apps/core/api/types.js";
import { checkEnvironment } from "@027apps/core/setup/environment.js";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import { t } from "@027apps/i18n/t.js";
import type { Locale } from "@027apps/i18n/types.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { getInfra } from "@/lib/api/door";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand-logo";
import { DocumentLang } from "@/components/document-lang";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { EnvironmentChecklist } from "./environment-checklist";
import { Button } from "@/components/ui/button";
import { backToSmtpAction, signOutAndRestartAction } from "./actions";
import { SMTP_COOKIE } from "./smtp-cookie";
import { PreferencesStep, type PreferencesValues } from "./preferences-step";
import { SetupForm } from "./setup-form";
import { SmtpStep } from "./smtp-step";

/**
 * Setup wizard (instance-config spec §7). Steps are derived from the real state,
 * never from stored progress:
 *
 *   1–2  environment checklist + first super_admin (no session yet)
 *   3    SMTP test to the admin's own address (session + confirmation cookie)
 *   4–5  preferences (clears `setup_incomplete`) + optional FCM
 *
 * The proxy already redirects when a step does not apply; the guards here are
 * defence in depth for direct hits.
 */
export const instant = false;

const text = (value: JsonValue | undefined): string => (typeof value === "string" ? value : "");

function screen(
  children: React.ReactNode,
  locale: Locale,
  messages: TranslationMap,
  logoUrl: string | null,
) {
  return (
    <main lang={locale} className="bg-background p-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col justify-center gap-4">
        <header className="relative flex items-center justify-center">
          <BrandLogo logoUrl={logoUrl} size="xl" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <LocaleSwitcher locale={locale} label={t("Language", messages)} />
          </div>
        </header>
        {children}
      </div>
      <DocumentLang locale={locale} />
    </main>
  );
}

/** Steps 1–2: what the hosting must provide, then the first super_admin. */
async function creationStep(
  settingsDeps: SettingsDeps,
  locale: Locale,
  messages: TranslationMap,
  logoUrl: string | null,
) {
  const report = await checkEnvironment({
    db: settingsDeps.db,
    encryptionKey: {
      present: Boolean(process.env.SETTINGS_ENCRYPTION_KEY),
      valid: settingsDeps.encryption !== null,
    },
    sentryConfigured: Boolean(process.env.SENTRY_DSN),
  });
  return screen(
    <div className="flex w-full max-w-md flex-col gap-3">
      <EnvironmentChecklist report={report} messages={messages} />
      <SetupForm messages={messages} />
    </div>,
    locale,
    messages,
    logoUrl,
  );
}

/**
 * Re-observes the token lifetime on every wizard render, so fixing Supabase
 * unblocks the wizard. The token is refreshed first: a session opened before
 * the project's JWT expiry changed would otherwise report the old value forever.
 */
async function refreshJwtObservation(settingsDeps: SettingsDeps): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: refreshed } = await supabase.auth.refreshSession();
  const session = refreshed.session ?? (await supabase.auth.getSession()).data.session;
  const token = session?.access_token;
  const userId = session?.user?.id;
  if (!token || !userId) return;

  const observed = jwtExpirySeconds(token);
  if (observed === null) return;
  const { rows } = await settingsDeps.db.query(
    "select value from public.settings where key = 'security.jwt_expiry'",
  );
  if (rows[0]?.value === observed) return;
  await recordJwtExpiry(settingsDeps.db, userId, observed);
}

/** Blocks steps 3–5 when Supabase issues tokens with another lifetime. */
async function jwtExpiryBlocker(
  settingsDeps: SettingsDeps,
  locale: Locale,
  messages: TranslationMap,
  logoUrl: string | null,
) {
  const { rows } = await settingsDeps.db.query(
    "select value from public.settings where key = 'security.jwt_expiry'",
  );
  const observed = typeof rows[0]?.value === "number" ? rows[0].value : null;
  if (observed === null || observed === EXPECTED_JWT_EXPIRY_SECONDS) return null;

  return screen(
    <section className="w-full max-w-md rounded-card border border-destructive bg-surface p-6">
      <h2 className="text-sm font-semibold text-destructive">
        {t("Access tokens must last 900 s", messages)}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          "Your Supabase project issues tokens lasting {observed} s. Set the JWT expiry to {expected} seconds in the Supabase dashboard (Auth → Sessions), then sign in again: a session opened before the change keeps the old lifetime.",
          messages,
          { observed, expected: EXPECTED_JWT_EXPIRY_SECONDS },
        )}
      </p>
      <form action={signOutAndRestartAction} className="mt-3">
        <Button type="submit" variant="secondary">
          {t("Sign out and sign in again", messages)}
        </Button>
      </form>
    </section>,
    locale,
    messages,
    logoUrl,
  );
}

/** Step 3: SMTP verification screen with the signed-in admin's own address. */
async function smtpStep(locale: Locale, messages: TranslationMap, logoUrl: string | null) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return screen(
    <SmtpStep email={data.user?.email ?? ""} messages={messages} />,
    locale,
    messages,
    logoUrl,
  );
}

/** Origin of the current request, used to prefill the public URL. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

/** Steps 4–5: required preferences (clears `setup_incomplete`) + optional FCM. */
async function preferencesStep(
  settingsDeps: SettingsDeps,
  locale: Locale,
  messages: TranslationMap,
  logoUrl: string | null,
) {
  const settings = await readPublicSettings(settingsDeps);
  // Prefill the public URL with the current origin so it does not have to be
  // typed; a stable domain (or the Vercel branch alias) should replace it.
  const origin = await requestOrigin();
  const storedLocale = text(settings["localization.default_locale"]);
  const proposedLocale = !storedLocale || storedLocale === "en" ? locale : storedLocale;

  const values: PreferencesValues = {
    instanceName: text(settings["instance.name"]) || "027Apps",
    publicUrl: text(settings["instance.public_url"]) || origin,
    locale: proposedLocale,
    timezone: text(settings["localization.timezone"]) || "UTC",
    currency: text(settings["localization.default_currency"]) || "EUR",
    pushProvider: settings["notifications.push.provider"] === "fcm" ? "fcm" : "none",
    fcmProjectId: text(settings["notifications.push.fcm_project_id"]),
    fcmAppId: text(settings["notifications.push.fcm_app_id"]),
    fcmApiKey: text(settings["notifications.push.fcm_api_key"]),
    fcmSenderId: text(settings["notifications.push.fcm_sender_id"]),
    fcmServiceAccount: "",
    fcmServiceAccountConfigured:
      (
        await settingsDeps.db.query(
          "select 1 from public.settings where key = 'notifications.push.fcm_service_account' and value_encrypted is not null",
        )
      ).rows.length > 0,
  };

  const { rows } = await settingsDeps.db.query(
    "select code from public.currencies where enabled = true order by code",
  );
  const currencies = rows.map((row) => String(row.code));
  const enabledLocales = Array.isArray(settings["localization.enabled_locales"])
    ? (settings["localization.enabled_locales"] as string[])
    : ["en"];

  return screen(
    <div className="flex w-full max-w-md flex-col gap-2">
      <form action={backToSmtpAction}>
        <Button type="submit" variant="secondary">
          ← {t("Back to step 3 (email test)", messages)}
        </Button>
      </form>
      <PreferencesStep
        values={values}
        locales={SUPPORTED_LOCALES}
        enabledLocales={enabledLocales}
        timezones={Intl.supportedValuesOf("timeZone")}
        currencies={currencies}
        messages={messages}
        helpHref={`/help/firebase?lang=${locale}`}
      />
    </div>,
    locale,
    messages,
    logoUrl,
  );
}

export default async function SetupPage() {
  const { settingsDeps } = await getInfra();
  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = getDictionary(locale);
  const settings = await readPublicSettings(settingsDeps);
  const logoUrl = typeof settings["instance.logo_url"] === "string" ? settings["instance.logo_url"] : null;

  if (!(await hasActiveSuperAdmin(settingsDeps))) {
    return creationStep(settingsDeps, locale, messages, logoUrl);
  }
  if (!(await isSetupIncomplete(settingsDeps))) redirect("/");

  await refreshJwtObservation(settingsDeps);
  const blocker = await jwtExpiryBlocker(settingsDeps, locale, messages, logoUrl);
  if (blocker) return blocker;

  const smtpConfirmed = cookieStore.get(SMTP_COOKIE)?.value === "1";
  return smtpConfirmed
    ? preferencesStep(settingsDeps, locale, messages, logoUrl)
    : smtpStep(locale, messages, logoUrl);
}
