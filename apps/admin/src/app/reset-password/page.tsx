import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import { t } from "@027apps/i18n/t.js";
import { BrandLogo } from "@/components/brand-logo";
import { DocumentLang } from "@/components/document-lang";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import { requestLocale } from "@/lib/request-locale";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resetPasswordAction } from "./actions";

export const instant = false;

export const metadata: Metadata = {
  title: "027Apps",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ error?: string | string[] }>;
}

const ERROR_KEYS: Record<string, string> = {
  short: "Use at least 12 characters.",
  long: "Use at most 200 characters.",
  mismatch: "Passwords do not match.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  invalid: "The link is not valid or has expired. Request a new one.",
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const supabase = await createSupabaseServerClient();
  const [{ data }, params, locale] = await Promise.all([
    supabase.auth.getUser(),
    searchParams,
    requestLocale(),
  ]);
  if (!data.user) redirect("/forgot-password");

  const messages = getDictionary(locale);
  const rawError = typeof params.error === "string" ? params.error : "";
  const errorKey = ERROR_KEYS[rawError];

  return (
    <main lang={locale} className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <BrandLogo size="md" />
        <div>
          <h1 className="text-2xl font-semibold">{t("Choose a new password", messages)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Use at least 12 characters. Your other devices will be signed out.", messages)}
          </p>
        </div>

        {errorKey && (
          <p
            role="alert"
            className="rounded-card border border-border bg-surface p-3 text-sm text-destructive"
          >
            {t(errorKey, messages)}
          </p>
        )}

        <form
          action={resetPasswordAction}
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("New password", messages)}</span>
            <input
              type="password"
              name="password"
              required
              minLength={12}
              maxLength={200}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("Confirm password", messages)}</span>
            <input
              type="password"
              name="confirmation"
              required
              minLength={12}
              maxLength={200}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>
          <Button type="submit" variant="primary" className="min-h-11">
            {t("Save password", messages)}
          </Button>
        </form>

        <Link href="/forgot-password" className="text-xs font-semibold text-accent hover:underline">
          {t("Request another link", messages)}
        </Link>
      </div>
      <DocumentLang locale={locale} />
    </main>
  );
}
