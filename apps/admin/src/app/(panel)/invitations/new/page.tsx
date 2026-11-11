import { cookies } from "next/headers";
import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { InvitationCreateForm } from "@/components/invitation-create-form";
import { PanelForbidden } from "@/components/panel-forbidden";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadCategories, loadModuleChoices, type CategoryRow } from "@/lib/panel-categories";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";

/** The page reads the session while rendering; opt out of the static shell. */
export const instant = false;

function NewInvitationBreadcrumb({ messages }: { messages: TranslationMap }) {
  return (
    <nav aria-label={t("Breadcrumb", messages)} className="text-xs text-muted-foreground">
      <Link
        href="/invitations"
        className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("Invitations", messages)}
      </Link>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{t("New", messages)}</span>
    </nav>
  );
}

function readCategories(value: Awaited<ReturnType<typeof loadCategories>>): CategoryRow[] {
  return value.ok ? value.categories : [];
}

export default async function NewInvitationPage() {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const [categories, moduleChoices] = await Promise.all([
    loadCategories({ offset: 0, limit: 100 }),
    loadModuleChoices(),
  ]);
  const categoryRows = readCategories(categories);

  return (
    <section className="flex flex-col gap-4">
      <NewInvitationBreadcrumb messages={messages} />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-bold">{t("New invitation", messages)}</h1>
          <p className="text-xs text-muted-foreground">
            {t("Invite someone to give them access to this instance.", messages)}
          </p>
        </div>
        <Link
          href="/invitations"
          className="inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Back", messages)}
        </Link>
      </header>

      <InvitationCreateForm
        categories={categoryRows.map((category) => ({ id: category.id, name: category.name }))}
        modules={moduleChoices.ok ? moduleChoices.modules : []}
        optionsUnavailable={!categories.ok || !moduleChoices.ok}
        defaultLocale={locale}
        messages={messages}
      />
    </section>
  );
}
