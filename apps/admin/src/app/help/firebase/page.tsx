import { cookies } from "next/headers";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import { t } from "@027apps/i18n/t.js";
import { BrandLogo } from "@/components/brand-logo";
import { DocumentLang } from "@/components/document-lang";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { HelpLocaleSwitcher } from "./locale-switcher";

export const instant = false;

interface HelpPageProps {
  searchParams: Promise<{ lang?: string | string[] }>;
}

export default async function HelpPage({ searchParams }: HelpPageProps) {
  const [{ lang }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const locale = resolveLocale({
    query: typeof lang === "string" ? lang : null,
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
  });
  const messages = getDictionary(locale);

  return (
    <main lang={locale} className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <BrandLogo size="md" />
          <HelpLocaleSwitcher locale={locale} label={t("Language", messages)} />
        </header>
        <div>
          <h1 className="text-2xl font-semibold">{t("Set up Firebase Cloud Messaging", messages)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "Follow these steps to connect Firebase push notifications to your 027Apps installation.",
              messages,
            )}
          </p>
          <a
            href="https://console.firebase.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-accent underline"
          >
            {t("Open Firebase console", messages)}
          </a>
        </div>

        <ol className="flex flex-col gap-4">
          <li className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">{t("1. What FCM is for", messages)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "Firebase Cloud Messaging (FCM) delivers push notifications to the 027Apps Android app.",
                messages,
              )}
            </p>
          </li>
          <li className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">{t("2. Create a Firebase project", messages)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "In the Firebase console, create a project for this 027Apps instance. Use the same project for every value below.",
                messages,
              )}
            </p>
          </li>
          <li className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">{t("3. Add the Android app", messages)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("Register an Android app with the package name", messages)}{" "}
              <code className="text-foreground">com.rferic.zero27apps</code>.{" "}
              {t("The package must match the app exactly.", messages)}
            </p>
          </li>
          <li className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">{t("4. Copy the public client values", messages)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "Copy the project ID, app ID, web API key and sender ID from the Firebase app settings. These four values identify the client app; the web API key is public.",
                messages,
              )}
            </p>
          </li>
          <li className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">{t("5. Generate a service account", messages)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "Go to Project settings → Service accounts and generate a new private key. Keep the JSON file secret: the wizard stores it encrypted and never displays it again.",
                messages,
              )}
            </p>
          </li>
          <li className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">{t("6. Enable the FCM API", messages)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "Check that the Firebase Cloud Messaging API is enabled for this project in Google Cloud.",
                messages,
              )}
            </p>
          </li>
          <li className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">{t("7. Finish in the setup wizard", messages)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "Paste the four client values and the service account JSON into the notifications section, then choose Firebase Cloud Messaging as the provider.",
                messages,
              )}
            </p>
          </li>
          <li className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">{t("8. Protect the credentials", messages)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "Never commit or share the service account JSON. The web API key is public, but the service account is a secret. The Android app must keep using com.rferic.zero27apps.",
                messages,
              )}
            </p>
          </li>
        </ol>
      </div>
      <DocumentLang locale={locale} />
    </main>
  );
}
