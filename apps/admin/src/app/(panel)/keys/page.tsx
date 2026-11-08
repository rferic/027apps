import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterSelect } from "@/components/ui/filter-select";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { formatDate } from "@/lib/format-date";
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
import {
  loadApiKeyOwners,
  loadApiKeys,
  type ApiKeyKind,
  type ApiKeyOwner,
  type ApiKeyRow,
  type ApiKeyStateFilter,
} from "@/lib/panel-keys";

/**
 * The page reads the session while rendering; the layout's opt-out is not
 * inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

type StateFilter = ApiKeyStateFilter;
type KindFilter = "all" | "service" | "delegated";

interface KeysFilters {
  state: StateFilter;
  kind: KindFilter;
  user?: string;
}

interface KeysSearchParams {
  state?: string | string[];
  kind?: string | string[];
  user?: string | string[];
  page?: string | string[];
}

/** The list defaults to the live state: revoked keys stay out of the way. */
const DEFAULT_STATE: StateFilter = "active";
/** No kind filter unless the URL asks for one. */
const DEFAULT_KIND: KindFilter = "all";

/** A user filter must be a uuid; anything else is ignored like an unknown kind. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseFilter(value: string | undefined): StateFilter {
  return value === "revoked" || value === "expired" || value === "all" || value === "active"
    ? value
    : DEFAULT_STATE;
}

function parseKind(value: string | undefined): KindFilter {
  return value === "service" || value === "delegated" ? value : DEFAULT_KIND;
}

function parseUser(value: string | undefined): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}

/** The default `active` is omitted so the canonical URL stays clean. */
function stateParam(filter: StateFilter): StateFilter | undefined {
  return filter === DEFAULT_STATE ? undefined : filter;
}

function kindParam(filter: KindFilter): KindFilter | undefined {
  return filter === DEFAULT_KIND ? undefined : filter;
}

/** The owner only refines delegated keys: with `service` it is never sent. */
function ownerParam(filters: KeysFilters): string | undefined {
  return filters.kind === "service" ? undefined : filters.user;
}

function keysHref(filters: KeysFilters, page: number): string {
  return pageHref(
    "/keys",
    {
      state: stateParam(filters.state),
      kind: kindParam(filters.kind),
      user: ownerParam(filters),
    },
    page,
  );
}

function hasActiveFilters(filters: KeysFilters): boolean {
  return (
    filters.state !== DEFAULT_STATE ||
    filters.kind !== DEFAULT_KIND ||
    ownerParam(filters) !== undefined
  );
}

function kindLabel(kind: ApiKeyKind, messages: TranslationMap): string {
  return kind === "service" ? t("Service", messages) : t("Delegated", messages);
}

function kindVariant(kind: ApiKeyKind): BadgeVariant {
  return kind === "service" ? "success" : "neutral";
}

/**
 * Derived lifecycle status: revocation wins over expiry, so a revoked key is
 * never shown as expired. The Core filters with `now()` in the database; the
 * badge only needs a consistent instant for the rows it receives.
 */
function KeyStatusBadge({
  row,
  now,
  messages,
}: {
  row: ApiKeyRow;
  now: number;
  messages: TranslationMap;
}) {
  if (row.revoked_at) {
    return <Badge variant="destructive">{t("Revoked", messages)}</Badge>;
  }
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= now) {
    return <Badge variant="neutral">{t("Expired", messages)}</Badge>;
  }
  return <Badge variant="success">{t("Active", messages)}</Badge>;
}

function ownerLabel(row: ApiKeyRow, messages: TranslationMap): string {
  return row.kind === "service" ? t("Instance", messages) : row.owner;
}

function roleCapLabel(row: ApiKeyRow, messages: TranslationMap): string | null {
  // The cap only exists for service keys; a stale value on a delegated key
  // is ignored by the guard and must not be shown as if it mattered.
  if (row.kind !== "service" || !row.roleCap) return null;
  return row.roleCap === "super_admin"
    ? t("Super administrator", messages)
    : t("Administrator", messages);
}

function OwnerCell({ row, messages }: { row: ApiKeyRow; messages: TranslationMap }) {
  const cap = roleCapLabel(row, messages);
  return (
    <div className="flex flex-col gap-1">
      <span className="font-semibold">{ownerLabel(row, messages)}</span>
      {cap && <Badge variant="neutral">{cap}</Badge>}
    </div>
  );
}

function filterParams(filters: KeysFilters): Record<string, string> {
  const params: Record<string, string> = {};
  const state = stateParam(filters.state);
  if (state) params.state = state;
  const kind = kindParam(filters.kind);
  if (kind) params.kind = kind;
  const user = ownerParam(filters);
  if (user) params.user = user;
  return params;
}

function KeysFilter({
  filters,
  owners,
  messages,
}: {
  filters: KeysFilters;
  owners: ApiKeyOwner[];
  messages: TranslationMap;
}) {
  // The owner select only makes sense for delegated keys: a service key has no
  // user, so the control disappears and the URL never carries `user` with it.
  const params = filterParams(filters);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        name="state"
        id="keys-state"
        label={t("Status", messages)}
        value={filters.state}
        basePath="/keys"
        params={params}
        options={[
          { value: "active", label: t("Active", messages) },
          { value: "expired", label: t("Expired", messages) },
          { value: "revoked", label: t("Revoked", messages) },
          // A real value: "All" is an explicit `state=all`, never a missing key.
          { value: "all", label: t("All", messages) },
        ]}
      />
      <FilterSelect
        name="kind"
        id="keys-kind"
        label={t("Type", messages)}
        value={filters.kind}
        basePath="/keys"
        params={params}
        options={[
          { value: "all", label: t("All types", messages) },
          { value: "service", label: t("Service", messages) },
          { value: "delegated", label: t("Delegated", messages) },
        ]}
      />
      {filters.kind !== "service" && (
        <FilterSelect
          name="user"
          id="keys-owner"
          label={t("Owner", messages)}
          value={filters.user ?? ""}
          basePath="/keys"
          params={params}
          options={[
            { value: "", label: t("All owners", messages) },
            ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
            // A filtered owner may have been deactivated since the URL was
            // built: keep the value selectable instead of silently showing All.
            ...(filters.user && !owners.some((owner) => owner.id === filters.user)
              ? [{ value: filters.user, label: filters.user }]
              : []),
          ]}
        />
      )}
      {hasActiveFilters(filters) && (
        <Link
          href="/keys"
          className="min-h-11 py-3 text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Clear filters", messages)}
        </Link>
      )}
    </div>
  );
}

interface KeysViewProps {
  rows: ApiKeyRow[];
  now: number;
  locale: Locale;
  timeZone: string;
  messages: TranslationMap;
}

function KeyNameLink({ row }: { row: ApiKeyRow }) {
  return (
    <Link
      href={`/keys/${encodeURIComponent(row.id)}`}
      className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {row.name}
    </Link>
  );
}

function KeysTable({ rows, now, locale, timeZone, messages }: KeysViewProps) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">{t("API keys", messages)}</caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Name", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Kind", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Owner", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Expires", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Last used", messages)}
            </th>
            <th scope="col" className="py-2 font-semibold">
              {t("Status", messages)}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border align-top">
              <td className="py-2 pr-3">
                <KeyNameLink row={row} />
              </td>
              <td className="py-2 pr-3">
                <Badge variant={kindVariant(row.kind)}>{kindLabel(row.kind, messages)}</Badge>
              </td>
              <td className="py-2 pr-3">
                <OwnerCell row={row} messages={messages} />
              </td>
              <td className="py-2 pr-3">
                {row.expiresAt ? formatDate(row.expiresAt, { locale, timeZone }) : t("Never", messages)}
              </td>
              <td className="py-2 pr-3">
                {row.last_used_at ? formatDate(row.last_used_at, { locale, timeZone }) : t("Never", messages)}
              </td>
              <td className="py-2 pr-3">
                <KeyStatusBadge row={row} now={now} messages={messages} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeysCards({ rows, now, locale, timeZone, messages }: KeysViewProps) {
  return (
    <ul className="flex flex-col gap-2 sm:hidden">
      {rows.map((row) => (
        <li key={row.id} className="rounded-card border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <KeyNameLink row={row} />
            <Badge variant={kindVariant(row.kind)}>{kindLabel(row.kind, messages)}</Badge>
            <KeyStatusBadge row={row} now={now} messages={messages} />
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t("Owner", messages)}</dt>
            <dd>
              <OwnerCell row={row} messages={messages} />
            </dd>
            <dt className="text-muted-foreground">{t("Expires", messages)}</dt>
            <dd>{row.expiresAt ? formatDate(row.expiresAt, { locale, timeZone }) : t("Never", messages)}</dd>
            <dt className="text-muted-foreground">{t("Last used", messages)}</dt>
            <dd>{row.last_used_at ? formatDate(row.last_used_at, { locale, timeZone }) : t("Never", messages)}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function KeysEmpty({ filtered, messages }: { filtered: boolean; messages: TranslationMap }) {
  if (filtered) {
    return (
      <div className="rounded-card border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold">{t("No API keys match this filter.", messages)}</h2>
        <Link
          href="/keys"
          className="mt-2 inline-block text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Clear filter", messages)}
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">{t("No API keys yet.", messages)}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("Create a key to let an integration call the API without a user session.", messages)}
      </p>
    </div>
  );
}

function KeysBody({
  data,
  filters,
  owners,
  page,
  locale,
  timeZone,
  messages,
}: {
  data: Awaited<ReturnType<typeof loadApiKeys>>;
  filters: KeysFilters;
  owners: ApiKeyOwner[];
  page: number;
  locale: Locale;
  timeZone: string;
  messages: TranslationMap;
}) {
  if (!data.ok) {
    return (
      <PanelError
        error={data}
        heading={t("We couldn't load the API keys.", messages)}
        retryHref={keysHref(filters, page)}
        messages={messages}
      />
    );
  }

  const rows = data.apiKeys;
  const now = new Date().getTime();
  // Every filter is applied by the API, so an empty page with one is a real
  // "no match", not an empty instance.
  const filtered =
    filters.state !== DEFAULT_STATE ||
    filters.kind !== DEFAULT_KIND ||
    ownerParam(filters) !== undefined;
  return (
    <>
      <KeysFilter filters={filters} owners={owners} messages={messages} />
      {rows.length === 0 ? (
        <KeysEmpty filtered={filtered} messages={messages} />
      ) : (
        <>
          <KeysTable
            rows={rows}
            now={now}
            locale={locale}
            timeZone={timeZone}
            messages={messages}
          />
          <KeysCards
            rows={rows}
            now={now}
            locale={locale}
            timeZone={timeZone}
            messages={messages}
          />
        </>
      )}
      <Pagination
        page={page}
        pages={pageCount(data.total)}
        hrefFor={(target) => keysHref(filters, target)}
        messages={messages}
      />
    </>
  );
}

/**
 * Resolves the list data for a render. A service kind has no owner, so a
 * stale `user` in the URL is dropped by redirecting to the canonical address;
 * the API rejects that pair instead of returning a misleading empty list.
 */
async function loadKeysView(
  filters: KeysFilters,
  page: number,
): Promise<{ data: Awaited<ReturnType<typeof loadApiKeys>>; owners: ApiKeyOwner[] }> {
  if (filters.kind === "service" && filters.user) {
    redirect(keysHref({ ...filters, user: undefined }, page));
  }

  const user = ownerParam(filters);
  const data = await loadApiKeys({
    offset: pageOffset(page),
    state: filters.state,
    ...(filters.kind !== DEFAULT_KIND ? { kind: filters.kind } : {}),
    ...(user ? { user } : {}),
  });
  if (filters.kind === "service") return { data, owners: [] };

  const loaded = await loadApiKeyOwners();
  return { data, owners: loaded.ok ? loaded.owners : [] };
}

export default async function KeysPage({
  searchParams,
}: {
  searchParams: Promise<KeysSearchParams>;
}) {
  const gate = await requirePanel("super_admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const timeZone = await loadPanelTimeZone();

  const params = await searchParams;
  const filters: KeysFilters = {
    state: parseFilter(firstParam(params.state)),
    kind: parseKind(firstParam(params.kind)),
    user: parseUser(firstParam(params.user)),
  };
  const page = parsePage(firstParam(params.page));
  const { data, owners } = await loadKeysView(filters, page);

  if (data.ok && page > pageCount(data.total)) {
    const target = pageCount(data.total);
    redirect(keysHref(filters, target));
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-bold">{t("API keys", messages)}</h1>
          <p className="text-xs text-muted-foreground">
            {t("Credentials for integrations and automated clients.", messages)}
          </p>
        </div>
        <Link
          href="/keys/new"
          className="inline-flex min-h-11 items-center rounded-control border border-transparent bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Create API key", messages)}
        </Link>
      </header>

      <KeysBody
        data={data}
        filters={filters}
        owners={owners}
        page={page}
        locale={locale}
        timeZone={timeZone}
        messages={messages}
      />
    </section>
  );
}
