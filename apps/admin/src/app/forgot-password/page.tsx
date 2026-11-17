import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import { t } from "@027apps/i18n/t.js";
import { BrandLogo } from "@/components/brand-logo";
import { DocumentLang } from "@/components/document-lang";
import { SubmitButton } from "@/app/(auth)/submit-button";
import { inputClass } from "@/components/ui/form";
import { requestLocale } from "@/lib/request-locale";
import { requestResetAction } from "./actions";

export const instant = false;

export const metadata: Metadata = {
  title: "027Apps",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface ForgotPasswordPageProps {
  searchParams: Promise<{ sent?: string | string[]; notice?: string | string[] }>;
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const [{ sent, notice }, locale] = await Promise.all([searchParams, requestLocale()]);
  const messages = getDictionary(locale);
  const wasSent = sent === "1";

  return (
    <main lang={locale} className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <BrandLogo size="md" />
        <div>
          <h1 className="text-2xl font-semibold">{t("Reset your password", messages)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "Enter the email address of your account. We'll send you a link to choose a new password.",
              messages,
            )}
          </p>
        </div>

        {notice === "invalid" && (
          <p
            role="alert"
            className="rounded-card border border-border bg-surface p-3 text-sm text-destructive"
          >
            {t(
              "The link is not valid or has expired. Request a new one.",
              messages,
            )}
          </p>
        )}

        {wasSent ? (
          <p
            role="status"
            className="rounded-card border border-border bg-surface p-4 text-sm text-muted-foreground"
          >
            {t(
              "If that email has an account, you will receive a link in a few minutes.",
              messages,
            )}
          </p>
        ) : (
          <form
            action={requestResetAction}
            className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t("Email", messages)}</span>
              <input
                type="email"
                name="email"
                required
                maxLength={320}
                autoComplete="email"
                className={inputClass}
              />
            </label>
            <SubmitButton
              label={t("Send link", messages)}
              pendingLabel={t("Sending…", messages)}
              variant="primary"
              className="min-h-11"
            />
          </form>
        )}

        <Link href="/login" className="text-xs font-semibold text-accent hover:underline">
          {t("Back to sign in", messages)}
        </Link>
      </div>
      <DocumentLang locale={locale} />
    </main>
  );
}
