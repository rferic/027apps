import type { ReactNode } from "react";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { signOutAction } from "@/app/(auth)/actions";
import { APP_NAME } from "@/lib/brand";
import type { PanelUser } from "@/lib/panel-guard";
import { BrandLogo } from "./brand-logo";
import { LocaleSwitcher } from "./locale-switcher";
import { Button } from "./ui/button";

interface PanelHeaderProps {
  user: PanelUser;
  locale: Locale;
  messages: TranslationMap;
  /** `instance.name`; empty falls back to the product name. */
  instanceName: string;
  logoUrl: string | null;
  /** Mobile-only navigation trigger, placed before the brand. */
  menu?: ReactNode;
}

/** Literal keys so `i18n:scan` sees each role label. */
function roleLabel(role: PanelUser["role"], messages: TranslationMap): string {
  switch (role) {
    case "super_admin":
      return t("Super admin", messages);
    case "admin":
      return t("Admin", messages);
    default:
      return t("User", messages);
  }
}

/**
 * Panel header (UX review §4): identity on the left, global preferences and
 * the session menu on the right. The user menu is a `<details>` so it works
 * without JavaScript, and it is the only place "Log out" lives.
 */
export function PanelHeader({ user, locale, messages, instanceName, logoUrl, menu }: PanelHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
      <div className="flex min-w-0 items-center gap-3">
        {menu}
        <BrandLogo
          logoUrl={logoUrl}
          name={instanceName.trim() || APP_NAME}
          size="lg"
          variant="mark"
          className="shrink-0"
        />
        <span className="truncate text-sm font-semibold">{instanceName.trim() || APP_NAME}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <LocaleSwitcher locale={locale} label={t("Language", messages)} className="min-h-11" />
        <details className="relative min-w-0">
          <summary className="flex min-h-11 min-w-0 cursor-pointer list-none items-center gap-2 rounded-control border border-border px-2.5 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-accent">
            <span className="max-w-24 truncate font-semibold sm:max-w-36">
              {user.displayName || user.email}
            </span>
            <span className="hidden text-muted-foreground sm:block">{roleLabel(user.role, messages)}</span>
          </summary>
          <div className="absolute right-0 z-10 mt-1 flex w-52 flex-col gap-2 rounded-card border border-border bg-surface p-3 shadow-lg">
            <span className="hidden truncate text-xs text-muted-foreground sm:block">{user.email}</span>
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" className="min-h-11 w-full">
                {t("Log out", messages)}
              </Button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
