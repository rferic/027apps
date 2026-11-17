import { Suspense } from "react";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import { t } from "@027apps/i18n/t.js";
import { DocumentLang } from "@/components/document-lang";
import { loadPanelSettings } from "@/lib/panel-settings";
import { requestLocale } from "@/lib/request-locale";
import { LoginForm } from "./login-form";

/**
 * Login page (email + password). The session cookie is set by the server
 * action via @supabase/ssr (`HttpOnly`/`Secure`/`SameSite`), so credentials
 * never touch client JS. Auth failures come back as `?error=` and the notices
 * (`password-reset`, `access-revoked`, `session-expired`, `invitation-redeemed`)
 * as `?notice=` in the URL.
 */
export const instant = false;

export default async function LoginPage() {
  const [locale, settings] = await Promise.all([requestLocale(), loadPanelSettings()]);
  const messages = getDictionary(locale);
  const instanceName =
    typeof settings["instance.name"] === "string" && settings["instance.name"].trim().length > 0
      ? settings["instance.name"].trim()
      : "027Apps";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense
        fallback={<div className="text-sm text-muted-foreground">{t("Loading…", messages)}</div>}
      >
        <LoginForm messages={messages} instanceName={instanceName} />
      </Suspense>
      <DocumentLang locale={locale} />
    </div>
  );
}
