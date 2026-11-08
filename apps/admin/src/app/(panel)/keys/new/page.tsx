import { cookies } from "next/headers";
import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { ApiKeyCreateForm } from "@/components/api-key-create-form";
import { PanelForbidden } from "@/components/panel-forbidden";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import { loadActiveDelegatedCounts, loadApiKeyOwners } from "@/lib/panel-keys";

/** The page reads the session while rendering; opt out of the static shell. */
export const instant = false;

function NewKeyBreadcrumb({ messages }: { messages: TranslationMap }) {
  return (
    <nav aria-label={t("Breadcrumb", messages)} className="text-xs text-muted-foreground">
      <Link
        href="/keys"
        className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("API keys", messages)}
      </Link>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{t("New", messages)}</span>
    </nav>
  );
}

export default async function NewApiKeyPage() {
  const gate = await requirePanel("super_admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const [ownersResult, activeCounts] = await Promise.all([
    loadApiKeyOwners(),
    loadActiveDelegatedCounts(),
  ]);

  return (
    <section className="flex flex-col gap-4">
      <NewKeyBreadcrumb messages={messages} />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-bold">{t("New API key", messages)}</h1>
          <p className="text-xs text-muted-foreground">
            {t("Credentials for integrations and automated clients.", messages)}
          </p>
        </div>
        <Link
          href="/keys"
          className="inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Back", messages)}
        </Link>
      </header>

      <ApiKeyCreateForm
        canCreateService={gate.user.role === "super_admin"}
        canChooseOwner={gate.user.role === "super_admin"}
        currentUserId={gate.user.id}
        owners={ownersResult.ok ? ownersResult.owners : []}
        activeCounts={activeCounts}
        messages={messages}
      />
    </section>
  );
}
