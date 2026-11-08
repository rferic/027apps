import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import { t } from "@027apps/i18n/t.js";
import { BrandLogo } from "@/components/brand-logo";
import { DocumentLang } from "@/components/document-lang";
import { APP_NAME } from "@/lib/brand";
import { isValidInviteToken } from "@/lib/invite-form";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { InviteForm } from "./invite-form";

export const instant = false;

export const metadata: Metadata = {
  title: APP_NAME,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

/**
 * Public redemption page. No session, no Supabase and no `?lang`: the locale
 * comes from `027_locale` because the link carries a token and is not a public
 * sharing surface. The token stays in the URL only until the form replaces the
 * history entry with the login notice.
 */
export default async function InvitePage({ params }: InvitePageProps) {
  const [{ token }, cookieStore] = await Promise.all([params, cookies()]);
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = getDictionary(locale);

  return (
    <main lang={locale} className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <BrandLogo size="md" />
        <div>
          <h1 className="text-2xl font-semibold">{t("Accept your invitation", messages)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Enter your email and choose a password to join this instance.", messages)}
          </p>
        </div>

        {isValidInviteToken(token) ? (
          <InviteForm token={token} messages={messages} />
        ) : (
          <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-destructive">
              {t("This invitation link is not valid.", messages)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("Ask an administrator for a new invitation.", messages)}
            </p>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t("Sign in", messages)}
            </Link>
          </section>
        )}
      </div>
      <DocumentLang locale={locale} />
    </main>
  );
}
