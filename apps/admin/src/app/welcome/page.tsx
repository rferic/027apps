import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import { t } from "@027apps/i18n/t.js";
import { BrandLogo } from "@/components/brand-logo";
import { DocumentLang } from "@/components/document-lang";
import { APP_NAME } from "@/lib/brand";
import { AndroidIcon } from "@/components/landing/android-icon";
import { SignInIcon } from "@/components/ui/sign-in-icon";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";

export const metadata: Metadata = {
  title: APP_NAME,
  robots: { index: false, follow: false },
};

/** Reads the locale cookie and the notice: no static shell. */
export const instant = false;

interface WelcomePageProps {
  searchParams: Promise<{ notice?: string | string[] }>;
}

const primaryLink =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control bg-android px-4 text-sm font-semibold text-android-foreground hover:opacity-90";
const secondaryLink =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control border border-border bg-muted px-4 text-sm font-semibold text-foreground hover:bg-muted/80";

/**
 * Public landing after a plain member redeems an invitation (D2). It holds no
 * session: the web panel is for administrators, so a `user` lands here with the
 * app download and a way back to login.
 */
export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const [{ notice }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = getDictionary(locale);
  const signInFailed = notice === "signin_failed";

  return (
    <main lang={locale} className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <BrandLogo size="md" />
        <div>
          <h1 className="text-2xl font-semibold">{t("Your account is ready", messages)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("You accepted the invitation and your account is active.", messages)}
          </p>
        </div>

        {signInFailed && (
          <p
            role="alert"
            className="rounded-card border border-border bg-surface p-3 text-sm text-destructive"
          >
            {t(
              "The account was created, but the automatic sign-in did not work. Sign in with your password.",
              messages,
            )}
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          {t(
            "This web panel is only for administrators. As a member, use the 027Apps app on Android.",
            messages,
          )}
        </p>

        <div className="flex flex-col gap-2">
          <Link href="/download/android" className={primaryLink}>
            <AndroidIcon />
            {t("Download for Android", messages)}
          </Link>
          <Link href="/login" className={secondaryLink}>
            <SignInIcon />
            {t("Sign in", messages)}
          </Link>
        </div>
      </div>
      <DocumentLang locale={locale} />
    </main>
  );
}
