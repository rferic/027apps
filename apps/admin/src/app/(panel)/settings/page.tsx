import { cookies } from "next/headers";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { CurrencySettings } from "@/components/currency-settings";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { SettingsForm } from "@/components/settings-form";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import {
  loadCurrencies,
  loadSettingsCategories,
  settingsVisibility,
} from "@/lib/panel-settings";

/**
 * The page reads the session while rendering; the layout's opt-out is not
 * inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

function CurrenciesBlock({
  data,
  messages,
}: {
  data: Awaited<ReturnType<typeof loadCurrencies>>;
  messages: TranslationMap;
}) {
  if (!data.ok) {
    return (
      <PanelError
        error={data}
        heading={t("We couldn't load the currencies.", messages)}
        retryHref="/settings"
        messages={messages}
      />
    );
  }
  return (
    <CurrencySettings
      defaultCode={data.default}
      currencies={data.currencies}
      messages={messages}
    />
  );
}

export default async function SettingsPage() {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const [settings, currencies] = await Promise.all([loadSettingsCategories(), loadCurrencies()]);
  const visibility = settingsVisibility(gate.user.role === "super_admin" ? "super_admin" : "admin");

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-bold">{t("Settings", messages)}</h1>
        <p className="text-xs text-muted-foreground">
          {t("Instance configuration. Changes apply to every client.", messages)}
        </p>
      </header>

      {settings.ok ? (
        <SettingsForm
          categories={settings.categories}
          restricted={visibility.restricted}
          messages={messages}
        />
      ) : (
        <PanelError
          error={settings}
          heading={t("We couldn't load the settings.", messages)}
          retryHref="/settings"
          messages={messages}
        />
      )}

      <CurrenciesBlock data={currencies} messages={messages} />
    </section>
  );
}
