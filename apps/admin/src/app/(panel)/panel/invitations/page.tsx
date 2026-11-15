import Link from "next/link";
import { panelLocale } from "@/lib/panel-locale";
import { redirect } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterSelect } from "@/components/ui/filter-select";
import { RowLink, clickableRowClass } from "@/components/ui/row-link";
import { formatDate } from "@/lib/format-date";
import { loadCategories, loadModuleChoices, type CategoryRow } from "@/lib/panel-categories";
import {
  loadInvitations,
  type InvitationRow,
  type InvitationStatus,
} from "@/lib/panel-invitations";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { loadPanelTimeZone } from "@/lib/panel-settings";
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

type StatusFilter = "all" | InvitationStatus;

interface InvitationsSearchParams {
  status?: string | string[];
  page?: string | string[];
}

/** The list defaults to pending even when the URL carries no `status`. */
const DEFAULT_STATUS: StatusFilter = "pending";

function parseStatus(value: string | undefined): StatusFilter {
  return value === "used" || value === "expired" || value === "revoked" || value === "all"
    ? value
    : DEFAULT_STATUS;
}

/** The default `pending` is omitted so the canonical URL stays clean. */
function statusParam(filter: StatusFilter): StatusFilter | undefined {
  return filter === DEFAULT_STATUS ? undefined : filter;
}

function InvitationsFilter({
  filter,
  messages,
}: {
  filter: StatusFilter;
  messages: TranslationMap;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        name="status"
        id="invitations-status"
        label={t("Status", messages)}
        value={filter}
        basePath="/panel/invitations"
        params={{}}
        options={[
          { value: "pending", label: t("Pending", messages) },
          { value: "used", label: t("Used", messages) },
          { value: "expired", label: t("Expired", messages) },
          { value: "revoked", label: t("Revoked", messages) },
          // A real value: "All" is an explicit `status=all`, never a missing key.
          { value: "all", label: t("All", messages) },
        ]}
      />
      {filter !== DEFAULT_STATUS && (
        <Link href="/panel/invitations" className="min-h-11 py-3 text-xs font-semibold text-accent hover:underline">
          {t("Clear filter", messages)}
        </Link>
      )}
    </div>
  );
}

function statusVariant(status: InvitationStatus): BadgeVariant {
  switch (status) {
    case "pending":
      return "success";
    case "used":
      return "neutral";
    default:
      return "destructive";
  }
}

function statusLabel(status: InvitationStatus, messages: TranslationMap): string {
  switch (status) {
    case "pending":
      return t("Pending", messages);
    case "used":
      return t("Used", messages);
    case "expired":
      return t("Expired", messages);
    default:
      return t("Revoked", messages);
  }
}

function categoryName(
  row: InvitationRow,
  categories: Map<string, string>,
  categoriesOk: boolean,
  messages: TranslationMap,
): string {
  if (!row.user_category_id) return "—";
  const name = categories.get(row.user_category_id);
  if (name) return name;
  // The name is unknown: a failed read is not the same as "no category".
  return categoriesOk ? row.user_category_id : t("Category unavailable", messages);
}

function moduleNames(row: InvitationRow, modules: Map<string, string>): string {
  if (row.modules.length === 0) return "—";
  return row.modules.map((key) => modules.get(key) ?? key).join(", ");
}

interface InvitationsViewProps {
  rows: InvitationRow[];
  locale: Locale;
  timeZone: string;
  categories: Map<string, string>;
  categoriesOk: boolean;
  modules: Map<string, string>;
  messages: TranslationMap;
}

function InvitationsTable({
  rows,
  locale,
  timeZone,
  categories,
  categoriesOk,
  modules,
  messages,
}: InvitationsViewProps) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-separate border-spacing-0 text-left text-xs">
        <caption className="sr-only">{t("Invitations", messages)}</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Email", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Name", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Status", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Category", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Modules", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 font-semibold">
              {t("Expires", messages)}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={clickableRowClass}>
              <td className="border-b border-border py-2 pr-3 font-semibold">
                <RowLink href={`/panel/invitations/${encodeURIComponent(row.id)}`} className="text-accent">
                  {row.email}
                </RowLink>
              </td>
              <td className="border-b border-border py-2 pr-3">{row.name}</td>
              <td className="border-b border-border py-2 pr-3">
                <Badge variant={statusVariant(row.status)}>{statusLabel(row.status, messages)}</Badge>
              </td>
              <td className="border-b border-border py-2 pr-3">
                {categoryName(row, categories, categoriesOk, messages)}
              </td>
              <td className="border-b border-border py-2 pr-3">{moduleNames(row, modules)}</td>
              <td className="border-b border-border py-2">
                {formatDate(row.expires_at, { locale, timeZone })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvitationsCards({
  rows,
  locale,
  timeZone,
  categories,
  categoriesOk,
  modules,
  messages,
}: InvitationsViewProps) {
  return (
    <ul className="flex flex-col gap-2 sm:hidden">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/panel/invitations/${encodeURIComponent(row.id)}`}
            className="flex min-h-11 flex-col gap-1 rounded-card border border-border bg-surface p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{row.email}</span>
              <Badge variant={statusVariant(row.status)}>{statusLabel(row.status, messages)}</Badge>
            </span>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">{t("Name", messages)}</dt>
              <dd>{row.name}</dd>
              <dt className="text-muted-foreground">{t("Category", messages)}</dt>
              <dd>{categoryName(row, categories, categoriesOk, messages)}</dd>
              <dt className="text-muted-foreground">{t("Modules", messages)}</dt>
              <dd>{moduleNames(row, modules)}</dd>
              <dt className="text-muted-foreground">{t("Expires", messages)}</dt>
              <dd>{formatDate(row.expires_at, { locale, timeZone })}</dd>
            </dl>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function InvitationsEmpty({
  filtered,
  messages,
}: {
  filtered: boolean;
  messages: TranslationMap;
}) {
  if (filtered) {
    return (
      <div className="rounded-card border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold">{t("No invitations match this filter.", messages)}</h2>
        <Link
          href="/panel/invitations"
          className="mt-2 inline-block text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Clear filter", messages)}
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">{t("No invitations yet.", messages)}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("Invite someone to give them access to this instance.", messages)}
      </p>
    </div>
  );
}

function readCategories(value: Awaited<ReturnType<typeof loadCategories>>): CategoryRow[] {
  return value.ok ? value.categories : [];
}

function InvitationsBody({
  data,
  filter,
  page,
  locale,
  timeZone,
  categories,
  moduleChoices,
  messages,
}: {
  data: Awaited<ReturnType<typeof loadInvitations>>;
  filter: StatusFilter;
  page: number;
  locale: Locale;
  timeZone: string;
  categories: Awaited<ReturnType<typeof loadCategories>>;
  moduleChoices: Awaited<ReturnType<typeof loadModuleChoices>>;
  messages: TranslationMap;
}) {
  const filters = { status: statusParam(filter) };

  if (!data.ok) {
    return (
      <PanelError
        error={data}
        heading={t("We couldn't load the invitations.", messages)}
        retryHref={pageHref("/panel/invitations", filters, page)}
        messages={messages}
      />
    );
  }

  const rows = data.invitations;
  const categoryRows = readCategories(categories);
  const categoryNames = new Map(categoryRows.map((category) => [category.id, category.name]));
  const moduleNames = new Map(
    (moduleChoices.ok ? moduleChoices.modules : []).map((module) => [module.key, module.name]),
  );
  const empty = data.total === 0 || rows.length === 0;

  return (
    <>
      <InvitationsFilter filter={filter} messages={messages} />
      {empty ? (
        <InvitationsEmpty filtered={filter !== DEFAULT_STATUS} messages={messages} />
      ) : (
        <>
          <InvitationsTable
            rows={rows}
            locale={locale}
            timeZone={timeZone}
            categories={categoryNames}
            categoriesOk={categories.ok}
            modules={moduleNames}
            messages={messages}
          />
          <InvitationsCards
            rows={rows}
            locale={locale}
            timeZone={timeZone}
            categories={categoryNames}
            categoriesOk={categories.ok}
            modules={moduleNames}
            messages={messages}
          />
        </>
      )}
      <Pagination
        page={page}
        pages={pageCount(data.total)}
        hrefFor={(target) => pageHref("/panel/invitations", filters, target)}
        messages={messages}
      />
    </>
  );
}

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams?: Promise<InvitationsSearchParams>;
} = {}) {
  const gate = await requirePanel("admin");

  const locale = panelLocale(gate.user);
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const timeZone = await loadPanelTimeZone();

  const params = (await searchParams) ?? {};
  const filter = parseStatus(firstParam(params.status));
  const page = parsePage(firstParam(params.page));

  const [invitations, categories, moduleChoices] = await Promise.all([
    loadInvitations({ offset: pageOffset(page), status: filter }),
    loadCategories({ offset: 0, limit: 100 }),
    loadModuleChoices(),
  ]);

  if (invitations.ok && page > pageCount(invitations.total)) {
    const target = pageCount(invitations.total);
    redirect(pageHref("/panel/invitations", { status: statusParam(filter) }, target));
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-bold">{t("Invitations", messages)}</h1>
          <p className="text-xs text-muted-foreground">
            {t("Invitations you have created.", messages)}
          </p>
        </div>
        <Link
          href="/panel/invitations/new"
          className="inline-flex min-h-11 items-center rounded-control border border-transparent bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Create invitation", messages)}
        </Link>
      </header>

      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
        <InvitationsBody
          data={invitations}
          filter={filter}
          page={page}
          locale={locale}
          timeZone={timeZone}
          categories={categories}
          moduleChoices={moduleChoices}
          messages={messages}
        />
      </div>
    </section>
  );
}
