import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { CurrencySettings } from "@/components/currency-settings";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { SettingsForm } from "@/components/settings-form";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import { categoryHelp, categoryLabel } from "@/lib/setting-text";
import {
  loadCurrencies,
  loadSettingsCategories,
  settingsVisibility,
} from "@/lib/panel-settings";
import {
  canSeeSettingsSection,
  settingsSectionBySlug,
  settingsSectionLabel,
  type SettingsSection,
} from "@/lib/settings-sections";

/**
 * The page reads the session and the section while rendering; the layout's
 * opt-out is not inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

function SectionBreadcrumb({
  section,
  messages,
}: {
  section: SettingsSection;
  messages: TranslationMap;
}) {
  return (
    <nav aria-label={t("Breadcrumb", messages)} className="text-xs text-muted-foreground">
      <Link
        href="/settings"
        className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("Settings", messages)}
      </Link>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{settingsSectionLabel(section, messages)}</span>
    </nav>
  );
}

function CurrenciesBlock({
  data,
  locale,
  messages,
}: {
  data: Awaited<ReturnType<typeof loadCurrencies>>;
  locale: Locale;
  messages: TranslationMap;
}) {
  if (!data.ok) {
    return (
      <PanelError
        error={data}
        heading={t("We couldn't load the currencies.", messages)}
        retryHref="/settings/localization"
        messages={messages}
      />
    );
  }
  return (
    <CurrencySettings
      defaultCode={data.default}
      currencies={data.currencies}
      locale={locale}
      messages={messages}
    />
  );
}

async function SectionContent({
  section,
  role,
  locale,
  messages,
}: {
  section: SettingsSection;
  role: "admin" | "super_admin";
  locale: Locale;
  messages: TranslationMap;
}) {
  const [settings, currencies] = await Promise.all([
    loadSettingsCategories(),
    section.slug === "localization" ? loadCurrencies() : Promise.resolve(null),
  ]);

  const fallbackLabel = settingsSectionLabel(section, messages);

  if (!settings.ok) {
    return (
      <section className="flex flex-col gap-4">
        <SectionBreadcrumb section={section} messages={messages} />
        <h1 className="text-base font-bold">{fallbackLabel}</h1>
        <PanelError
          error={settings}
          heading={t("We couldn't load the settings.", messages)}
          retryHref={`/settings/${section.slug}`}
          messages={messages}
        />
      </section>
    );
  }

  // Only this category reaches the form: the batch save therefore carries just
  // the keys of the section the user is looking at.
  const category = settings.categories.find(
    (candidate) => candidate.categoryKey === section.categoryKey,
  );
  if (!category) notFound();

  const label = categoryLabel(section.categoryKey, messages, category.label || fallbackLabel);
  const help = categoryHelp(section.categoryKey, messages, category.help);
  const restricted = settingsVisibility(role).restricted.filter(
    (setting) => setting.category === section.categoryKey,
  );

  return (
    <section className="flex flex-col gap-4">
      <SectionBreadcrumb section={section} messages={messages} />
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-bold">{label}</h1>
        <p className="text-xs text-muted-foreground">{help}</p>
      </header>

      <SettingsForm
        key={section.slug}
        categories={[category]}
        restricted={restricted}
        messages={messages}
      />

      {currencies && <CurrenciesBlock data={currencies} locale={locale} messages={messages} />}
    </section>
  );
}

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const { section: slug } = await params;
  const section = settingsSectionBySlug(slug);
  if (!section) notFound();

  const role = gate.user.role === "super_admin" ? "super_admin" : "admin";
  if (!canSeeSettingsSection(role, section)) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  return SectionContent({ section, role, locale, messages });
}
