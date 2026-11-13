import { t } from "@027apps/i18n/t.js";
import { panelLocale } from "@/lib/panel-locale";
import { ApiReference } from "@/components/api-reference";
import { PanelForbidden } from "@/components/panel-forbidden";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";

/**
 * The page resolves the session while rendering; the layout's opt-out is not
 * inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

export default async function ApiDocsPage() {
  const gate = await requirePanel("admin");

  const locale = panelLocale(gate.user);
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-bold">{t("API docs", messages)}</h1>
      </header>
      <ApiReference url="/api/v1/openapi.json" />
    </section>
  );
}
