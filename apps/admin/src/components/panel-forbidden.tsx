import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "./ui/button";
import { LocaleSwitcher } from "./locale-switcher";

interface PanelForbiddenProps {
  locale: Locale;
  messages: TranslationMap;
  /** Present when the guard already resolved a profile; never a role hint. */
  user?: { displayName: string; email: string };
  /** A standalone 403 replaces the whole layout and owns the full-screen main. */
  standalone?: boolean;
}

/**
 * Generic refusal: it never reveals which routes or roles exist, but it does
 * let the signed-in user change the language or close the session.
 */
export function PanelForbidden({ locale, messages, user, standalone = false }: PanelForbiddenProps) {
  const identity = user?.displayName.trim() || user?.email;

  const content = (
    <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-card border border-border bg-surface p-6 text-center">
      <p role="alert" className="text-sm font-semibold">
        {t("You do not have access to this page.", messages)}
      </p>
      {identity && <p className="max-w-full truncate text-xs text-muted-foreground">{identity}</p>}
      <LocaleSwitcher locale={locale} label={t("Language", messages)} className="min-h-11" />
      <form action={signOutAction} className="w-full">
        <Button type="submit" variant="secondary" className="min-h-11 w-full">
          {t("Log out", messages)}
        </Button>
      </form>
    </div>
  );

  if (standalone) {
    return (
      <main id="content" className="flex min-h-screen items-center justify-center bg-background p-6">
        {content}
      </main>
    );
  }

  return <section className="flex justify-center py-6">{content}</section>;
}
