import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import { t } from "@027apps/i18n/t.js";
import { AndroidIcon } from "@/components/landing/android-icon";
import { BrandLogo } from "@/components/brand-logo";
import { DocumentLang } from "@/components/document-lang";
import { cancelClass } from "@/components/ui/form";
import { loadPanelSettings, publicUrlFromSettings } from "@/lib/panel-settings";
import { requestLocale } from "@/lib/request-locale";

export const instant = false;

export const metadata: Metadata = {
  title: "027Apps",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface MigratePageProps {
  params: Promise<{ token: string }>;
}

/** Where the link points: the configured public URL wins over the request's Host. */
function requestOrigin(
  publicUrl: string | null,
  headerStore: { get(name: string): string | null },
): string {
  if (publicUrl) return publicUrl.replace(/\/+$/, "");
  const host = headerStore.get("host");
  if (!host) return "";
  const proto =
    headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Desktop landing of a migration QR. It never exchanges the code: the account
 * moves only from the new phone, which opens the app link. The token is only a
 * deep-link parameter here.
 */
export default async function MigratePage({ params }: MigratePageProps) {
  const [{ token }, headerStore, locale] = await Promise.all([
    params,
    headers(),
    requestLocale(),
  ]);
  const messages = getDictionary(locale);
  const origin = requestOrigin(publicUrlFromSettings(await loadPanelSettings()), headerStore);
  const valid = /^027_mig_[A-Za-z0-9_-]{1,200}$/.test(token);
  const appHref = origin
    ? `zero27apps://migrate/${encodeURIComponent(token)}?instance=${encodeURIComponent(origin)}`
    : null;

  return (
    <main lang={locale} className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <BrandLogo size="md" />
        <div>
          <h1 className="text-2xl font-semibold">{t("Move to a new phone", messages)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {valid
              ? t(
                  "This link moves your account to a new phone. Open it on the phone you want to use, with the 027Apps app installed.",
                  messages,
                )
              : t("This link is not valid.", messages)}
          </p>
        </div>

        {valid && appHref && (
          <>
            <a
              href={appHref}
              className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {t("Open in the app", messages)}
            </a>
            <p className="text-xs text-muted-foreground">
              {t(
                "Only the 027Apps app for Android can open it. The code lasts 60 seconds: if it has expired, generate a new one on the old phone.",
                messages,
              )}
            </p>
          </>
        )}

        <a
          href="/download/android"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-android px-4 text-sm font-semibold text-android-foreground hover:opacity-90"
        >
          <AndroidIcon />
          {t("Download for Android", messages)}
        </a>

        <Link href="/login" className={cancelClass}>
          {t("Back to sign in", messages)}
        </Link>
      </div>
      <DocumentLang locale={locale} />
    </main>
  );
}
