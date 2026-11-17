import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import { t } from "@027apps/i18n/t.js";
import { BrandLogo } from "@/components/brand-logo";
import { DocumentLang } from "@/components/document-lang";
import { Button } from "@/components/ui/button";
import { requestLocale } from "@/lib/request-locale";
import { confirmRecoveryAction } from "./actions";

export const instant = false;

export const metadata: Metadata = {
  title: "027Apps",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface ConfirmPageProps {
  searchParams: Promise<{
    token_hash?: string | string[];
    type?: string | string[];
    next?: string | string[];
  }>;
}

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

/**
 * Landing page of the recovery email. The GET only renders the button: the
 * token is spent by the POST when the person clicks, so link scanners that
 * prefetch the URL do not invalidate it.
 */
export default async function ConfirmRecoveryPage({ searchParams }: ConfirmPageProps) {
  const [params, locale] = await Promise.all([searchParams, requestLocale()]);
  const messages = getDictionary(locale);
  const tokenHash = first(params.token_hash);
  const type = first(params.type);
  const next = first(params.next);
  const valid = type === "recovery" && next === "/reset-password" && tokenHash.length > 0;

  return (
    <main lang={locale} className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <BrandLogo size="md" />
        <h1 className="text-2xl font-semibold">{t("Reset your password", messages)}</h1>

        {valid ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t("Confirm that you want to choose a new password.", messages)}
            </p>
            <form action={confirmRecoveryAction}>
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value="recovery" />
              <input type="hidden" name="next" value="/reset-password" />
              <Button type="submit" variant="primary" className="min-h-11 w-full">
                {t("Continue", messages)}
              </Button>
            </form>
          </>
        ) : (
          <p
            role="alert"
            className="rounded-card border border-border bg-surface p-3 text-sm text-destructive"
          >
            {t("The link is not valid or has expired. Request a new one.", messages)}
          </p>
        )}

        <Link href="/forgot-password" className="text-xs font-semibold text-accent hover:underline">
          {t("Request another link", messages)}
        </Link>
      </div>
      <DocumentLang locale={locale} />
    </main>
  );
}
