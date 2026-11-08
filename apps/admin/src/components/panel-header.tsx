import type { ReactNode } from "react";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { signOutAction } from "@/app/(auth)/actions";
import { APP_NAME } from "@/lib/brand";
import type { PanelUser } from "@/lib/panel-guard";
import type { Theme } from "@/lib/theme";
import { BrandLogo } from "./brand-logo";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeSwitcher } from "./theme-switcher";
import { UserMenu } from "./user-menu";
import { Button } from "./ui/button";

interface PanelHeaderProps {
  user: PanelUser;
  locale: Locale;
  messages: TranslationMap;
  /** Stored theme preference, so the switcher starts on the right option. */
  theme?: Theme;
  /** `instance.name`; empty falls back to the product name. */
  instanceName: string;
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
 * Panel header (UX review §4): identity on the left, the session menu on the
 * right. The user menu is a `<details>` so it works without JavaScript, and it
 * is the only place "Log out", the theme and the language live; keeping the
 * preferences compact gives the brand more room on mobile.
 */
export function PanelHeader({ user, locale, messages, theme, instanceName, menu }: PanelHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
      <div className="flex min-w-0 items-center gap-3">
        {menu}
        <BrandLogo
          name={instanceName.trim() || APP_NAME}
          size="md"
          variant="mark"
          className="shrink-0"
        />
        <span className="truncate text-sm font-semibold">{instanceName.trim() || APP_NAME}</span>
      </div>
      <UserMenu
        summary={
          <summary className="flex min-h-11 min-w-0 cursor-pointer list-none items-center gap-2 rounded-control border border-border px-2.5 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-accent">
            <span className="max-w-24 truncate font-semibold sm:max-w-36">
              {user.displayName || user.email}
            </span>
          </summary>
        }
      >
        <div
          data-user-menu
          className="absolute right-0 z-10 mt-1 flex w-64 flex-col gap-3 rounded-card border border-border bg-surface p-3 shadow-lg"
        >
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-semibold">{user.displayName || user.email}</span>
            <span className="text-xs text-muted-foreground">{roleLabel(user.role, messages)}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
          <hr className="border-border" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t("Theme", messages)}</span>
            <ThemeSwitcher messages={messages} theme={theme} className="min-h-11" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t("Language", messages)}
            </span>
            {/*
              Choosing a language calls router.refresh(), which re-renders the
              server tree; the route stays the same, so the menu itself decides
              when to close. The new locale is already applied either way.
            */}
            <LocaleSwitcher locale={locale} label={t("Language", messages)} className="min-h-11" />
          </div>
          <hr className="border-border" />
          <form action={signOutAction}>
            <Button type="submit" variant="secondary" className="min-h-11 w-full">
              {t("Log out", messages)}
            </Button>
          </form>
        </div>
      </UserMenu>
    </header>
  );
}
