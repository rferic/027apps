import Link from "next/link";
import { panelLocale } from "@/lib/panel-locale";
import { redirect } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { RowLink, clickableRowClass } from "@/components/ui/row-link";
import { loadCategories, type CategoryRow } from "@/lib/panel-categories";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import {
  firstParam,
  pageCount,
  pageHref,
  pageOffset,
  parsePage,
} from "@/lib/panel-pagination";

/**
 * The page reads the session while rendering; the layout's opt-out is not
 * inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

interface CategoriesSearchParams {
  q?: string | string[];
  page?: string | string[];
}

function filterCategories(rows: CategoryRow[], q: string): CategoryRow[] {
  if (!q) return rows;
  const needle = q.toLocaleLowerCase();
  return rows.filter(
    (row) =>
      row.name.toLocaleLowerCase().includes(needle) ||
      row.slug.toLocaleLowerCase().includes(needle),
  );
}

function CategoriesTable({ rows, messages }: { rows: CategoryRow[]; messages: TranslationMap }) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-separate border-spacing-0 text-left text-xs">
        <caption className="sr-only">{t("Categories", messages)}</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Name", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Slug", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Members", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 font-semibold">
              {t("Modules", messages)}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={clickableRowClass}>
              <td className="border-b border-border py-2 pr-3 font-semibold">
                <RowLink href={`/panel/categories/${row.id}`}>{row.name}</RowLink>
              </td>
              <td className="border-b border-border py-2 pr-3 font-mono text-[11px]">{row.slug}</td>
              <td className="border-b border-border py-2 pr-3">{row.member_count}</td>
              <td className="border-b border-border py-2">{row.modules.length}</td>
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
            href={`/panel/categories/${row.id}`}
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

function CategoriesEmpty({ q, messages }: { q: string; messages: TranslationMap }) {
  if (q) {
    return (
      <div className="rounded-card border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold">
          {t("No categories match {q}.", messages, { q })}
        </h2>
        <Link href="/panel/categories" className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">
          {t("Clear search", messages)}
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">{t("No categories yet.", messages)}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("Create a category to group members and assign modules to all of them.", messages)}
      </p>
    </div>
  );
}

function CategoriesBody({
  data,
  q,
  page,
  messages,
}: {
  data: Awaited<ReturnType<typeof loadCategories>>;
  q: string;
  page: number;
  messages: TranslationMap;
}) {
  if (!data.ok) {
    return (
      <PanelError
        error={data}
        heading={t("We couldn't load the categories.", messages)}
        retryHref={pageHref("/panel/categories", { q }, page)}
        messages={messages}
      />
    );
  }

  const rows = filterCategories(data.categories, q);
  const empty = data.total === 0 || rows.length === 0;

  return (
    <>
      <SearchInput
        name="q"
        value={q}
        basePath="/panel/categories"
        params={{}}
        label={t("Search by name or slug", messages)}
        placeholder={t("Search", messages)}
        messages={messages}
      />

      {empty ? (
        <CategoriesEmpty q={q} messages={messages} />
      ) : (
        <>
          <CategoriesTable rows={rows} messages={messages} />
          <CategoriesCards rows={rows} messages={messages} />
        </>
      )}

      <Pagination
        page={page}
        pages={pageCount(data.total)}
        hrefFor={(target) => pageHref("/panel/categories", { q }, target)}
        messages={messages}
      />
    </>
  );
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<CategoriesSearchParams>;
} = {}) {
  const gate = await requirePanel("admin");

  const locale = panelLocale(gate.user);
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const params = (await searchParams) ?? {};
  const q = (firstParam(params.q) ?? "").trim().slice(0, 100);
  const page = parsePage(firstParam(params.page));
  const data = await loadCategories({ offset: pageOffset(page) });

  if (data.ok && page > pageCount(data.total)) {
    redirect(pageHref("/panel/categories", { q }, pageCount(data.total)));
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-bold">{t("Categories", messages)}</h1>
          <p className="text-xs text-muted-foreground">
            {t("Groups of members and module access.", messages)}
          </p>
        </div>
        <Link
          href="/panel/categories/new"
          className="inline-flex min-h-11 items-center rounded-control border border-transparent bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Create category", messages)}
        </Link>
      </header>

      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
        <CategoriesBody data={data} q={q} page={page} messages={messages} />
      </div>
    </section>
  );
}
