import { cookies } from "next/headers";
import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { CategoryCreateForm } from "@/components/category-create-form";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadCategories, type CategoryRow } from "@/lib/panel-categories";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";

/**
 * The page reads the session while rendering; the layout's opt-out is not
 * inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

function CategoriesTable({ rows, messages }: { rows: CategoryRow[]; messages: TranslationMap }) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">{t("Categories", messages)}</caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Name", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Slug", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Members", messages)}
            </th>
            <th scope="col" className="py-2 font-semibold">
              {t("Modules", messages)}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="relative border-b border-border">
              <td className="py-2 pr-3 font-semibold">
                <Link
                  href={`/categories/${row.id}`}
                  className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {row.name}
                </Link>
              </td>
              <td className="py-2 pr-3 font-mono text-[11px]">{row.slug}</td>
              <td className="py-2 pr-3">{row.member_count}</td>
              <td className="py-2">{row.modules.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoriesCards({ rows, messages }: { rows: CategoryRow[]; messages: TranslationMap }) {
  return (
    <ul className="flex flex-col gap-2 sm:hidden">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/categories/${row.id}`}
            className="flex min-h-11 flex-col gap-1 rounded-card border border-border bg-surface p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="text-sm font-semibold">{row.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{row.slug}</span>
            <span className="text-xs text-muted-foreground">
              {t("Members", messages)}: {row.member_count}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("Modules", messages)}: {row.modules.length}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CategoriesEmpty({ messages }: { messages: TranslationMap }) {
  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">{t("No categories yet.", messages)}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("Create a category to group members and assign modules to all of them.", messages)}
      </p>
    </div>
  );
}

export default async function CategoriesPage() {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const data = await loadCategories();

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-bold">{t("Categories", messages)}</h1>
          <p className="text-xs text-muted-foreground">
            {t("Groups of members and module access.", messages)}
          </p>
        </div>
        <CategoryCreateForm messages={messages} />
      </header>

      {data.ok ? (
        data.categories.length === 0 ? (
          <CategoriesEmpty messages={messages} />
        ) : (
          <>
            <CategoriesTable rows={data.categories} messages={messages} />
            <CategoriesCards rows={data.categories} messages={messages} />
          </>
        )
      ) : (
        <PanelError
          error={data}
          heading={t("We couldn't load the categories.", messages)}
          retryHref="/categories"
          messages={messages}
        />
      )}
    </section>
  );
}
