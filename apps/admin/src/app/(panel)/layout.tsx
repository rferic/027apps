import { cookies } from "next/headers";
import { readPublicSettings } from "@027apps/core/settings/service.js";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { DocumentLang } from "@/components/document-lang";
import { PanelHeader } from "@/components/panel-header";
import { PanelNav } from "@/components/panel-nav";
import { getInfra } from "@/lib/api/door";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";

/**
 * The panel reads the session, the role and the instance settings on every
 * request: it opts out of the static shell instead of being prerendered.
 */
export const instant = false;

/** Generic refusal: it never reveals which routes or roles exist. */
function Forbidden({ locale, messages }: { locale: string; messages: TranslationMap }) {
  return (
    <main id="content" className="flex min-h-screen items-center justify-center bg-background p-6">
      <p
        role="alert"
        className="max-w-md rounded-card border border-border bg-surface p-6 text-center text-sm font-semibold"
      >
        {t("You do not have access to this page.", messages)}
      </p>
      <DocumentLang locale={locale} />
    </main>
  );
}

export default async function PanelLayout({ children }: LayoutProps<"/">) {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);
  if ("denied" in gate) return <Forbidden locale={locale} messages={messages} />;

  const { settingsDeps } = await getInfra();
  const settings = await readPublicSettings(settingsDeps);
  const instanceName = typeof settings["instance.name"] === "string" ? settings["instance.name"] : "";
  const logoUrl = typeof settings["instance.logo_url"] === "string" ? settings["instance.logo_url"] : null;

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[220px_1fr]">
      <aside className="hidden border-r border-border bg-muted p-3 lg:block">
        <PanelNav messages={messages} />
      </aside>
      <div className="flex min-w-0 flex-col">
        <PanelHeader
          user={gate.user}
          locale={locale}
          messages={messages}
          instanceName={instanceName}
          logoUrl={logoUrl}
        />
        <details className="border-b border-border bg-muted px-4 py-2 lg:hidden">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold focus-visible:ring-2 focus-visible:ring-accent">
            {t("Menu", messages)}
          </summary>
          <div className="pt-2">
            <PanelNav messages={messages} />
          </div>
        </details>
        <main id="content" className="flex-1 p-4">
          {children}
        </main>
      </div>
      <DocumentLang locale={locale} />
    </div>
  );
}
