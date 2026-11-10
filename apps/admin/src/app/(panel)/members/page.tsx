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
import { SearchInput } from "@/components/ui/search-input";
import { RowLink, clickableRowClass } from "@/components/ui/row-link";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { formatDate } from "@/lib/format-date";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { loadPanelTimeZone } from "@/lib/panel-settings";
import { requirePanel } from "@/lib/panel-guard";
import { loadCategories } from "@/lib/panel-categories";
import {
  loadMembers,
  MEMBERS_PAGE_SIZE,
  type MemberCategory,
  type MemberListSuccess,
  type MemberRole,
  type MemberRow,
  type MemberStateFilter,
} from "@/lib/panel-members";

/**
 * The page reads the session while rendering; the layout's opt-out is not
 * inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

interface MembersSearchParams {
  q?: string | string[];
  role?: string | string[];
  state?: string | string[];
  category?: string | string[];
  page?: string | string[];
}

type CategoryOption = { id: string; name: string };

/** A category id must be a uuid; anything else is ignored like an unknown role. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCategory(value: string | undefined): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** 1-based page from the query; anything invalid falls back to the first page. */
function parsePage(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

/** Only the three real roles filter; anything else means "all". */
function parseRole(value: string | undefined): MemberRole | undefined {
  return value === "super_admin" || value === "admin" || value === "user" ? value : undefined;
}

/**
 * The list defaults to active profiles even when the URL carries no `state`.
 * `all` is a real filter value (sent explicitly), not the absence of one.
 */
function parseState(value: string | undefined): MemberStateFilter {
  if (value === "deactivated" || value === "all") return value;
  return "active";
}

/** The default `active` is omitted so the canonical URL stays clean. */
function stateParam(state: MemberStateFilter): MemberStateFilter | undefined {
  return state === "active" ? undefined : state;
}

function membersHref(input: {
  q: string;
  role?: MemberRole;
  state: MemberStateFilter;
  category?: string;
  page: number;
}): string {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.role) params.set("role", input.role);
  const state = stateParam(input.state);
  if (state) params.set("state", state);
  if (input.category) params.set("category", input.category);
  if (input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/members?${query}` : "/members";
}

function roleVariant(role: MemberRow["role"]): BadgeVariant {
  switch (role) {
    case "super_admin":
      return "destructive";
    case "admin":
      return "success";
    default:
      return "neutral";
  }
}

function roleLabel(role: MemberRow["role"], messages: TranslationMap): string {
  switch (role) {
    case "super_admin":
      return t("Super admin", messages);
    case "admin":
      return t("Admin", messages);
    default:
      return t("User", messages);
  }
}

function statusVariant(row: MemberRow): BadgeVariant {
  return row.deactivated_at === null ? "success" : "destructive";
}

function statusLabel(row: MemberRow, messages: TranslationMap): string {
  return row.deactivated_at === null ? t("Active", messages) : t("Deactivated", messages);
}

/** A failed lookup is not the same as an account without email. */
function emailLabel(row: MemberRow, messages: TranslationMap): string {
  if (row.emailUnavailable) return t("Email unavailable", messages);
  return row.email ?? "—";
}

function MemberBadges({ row, messages }: { row: MemberRow; messages: TranslationMap }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge variant={roleVariant(row.role)}>{roleLabel(row.role, messages)}</Badge>
      <Badge variant={statusVariant(row)}>{statusLabel(row, messages)}</Badge>
    </span>
  );
}

/** At most three names; the rest collapse into a `+N` chip. */
const MAX_VISIBLE_CATEGORIES = 3;

function CategoryChips({ categories }: { categories: MemberCategory[] }) {
  if (categories.length === 0) return <span className="text-muted-foreground">—</span>;
  const visible = categories.slice(0, MAX_VISIBLE_CATEGORIES);
  const hidden = categories.length - visible.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {visible.map((category) => (
        <Badge key={category.id} variant="neutral">
          {category.name}
        </Badge>
      ))}
      {hidden > 0 && <Badge variant="neutral">{`+${hidden}`}</Badge>}
    </span>
  );
}

function MembersTable({ rows, locale, timeZone, messages }: { rows: MemberRow[]; locale: Locale; timeZone: string; messages: TranslationMap }) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-separate border-spacing-0 text-left text-xs">
        <caption className="sr-only">{t("Members", messages)}</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Name", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Email", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Role", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Status", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Categories", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 font-semibold">
              {t("Joined", messages)}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={clickableRowClass}>
              <td className="border-b border-border py-2 pr-3 font-semibold">
                <RowLink href={`/members/${row.id}`}>
                  {row.display_name || row.email || row.id}
                </RowLink>
              </td>
              <td className="border-b border-border py-2 pr-3">{emailLabel(row, messages)}</td>
              <td className="border-b border-border py-2 pr-3">
                <Badge variant={roleVariant(row.role)}>{roleLabel(row.role, messages)}</Badge>
              </td>
              <td className="border-b border-border py-2 pr-3">
                <Badge variant={statusVariant(row)}>{statusLabel(row, messages)}</Badge>
              </td>
              <td className="border-b border-border py-2 pr-3">
                <CategoryChips categories={row.categories} />
              </td>
              <td className="border-b border-border py-2">{formatDate(row.created_at, { locale, timeZone })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MembersCards({ rows, locale, timeZone, messages }: { rows: MemberRow[]; locale: Locale; timeZone: string; messages: TranslationMap }) {
  return (
    <ul className="flex flex-col gap-2 sm:hidden">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/members/${row.id}`}
            className="flex min-h-11 flex-col gap-1 rounded-card border border-border bg-surface p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{row.display_name || row.email || row.id}</span>
              <MemberBadges row={row} messages={messages} />
            </span>
            {(row.email || row.emailUnavailable) && (
              <span className="text-xs text-muted-foreground">{emailLabel(row, messages)}</span>
            )}
            <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <span>{t("Categories", messages)}:</span>
              <CategoryChips categories={row.categories} />
            </span>
            <span className="text-xs text-muted-foreground">
              {t("Joined", messages)}: {formatDate(row.created_at, { locale, timeZone })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MembersEmpty({
  q,
  filtered,
  messages,
}: {
  q: string;
  filtered: boolean;
  messages: TranslationMap;
}) {
  const heading = q
    ? t("No members match {q}.", messages, { q })
    : filtered
      ? t("No members match this filter.", messages)
      : t("No members yet.", messages);
  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">{heading}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("Invite someone to give them access to this instance.", messages)}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-accent">
        <Link href="/invitations" className="hover:underline">
          {t("Invite a member", messages)}
        </Link>
        {(q || filtered) && (
          <Link href="/members" className="hover:underline">
            {q ? t("Clear search", messages) : t("Clear filters", messages)}
          </Link>
        )}
      </div>
    </div>
  );
}

function MembersBody({
  data,
  q,
  role,
  state,
  category,
  page,
  locale,
  timeZone,
  messages,
}: {
  data: MemberListSuccess;
  q: string;
  role?: MemberRole;
  state: MemberStateFilter;
  category?: string;
  page: number;
  locale: Locale;
  timeZone: string;
  messages: TranslationMap;
}) {
  const pages = Math.max(1, Math.ceil(data.total / MEMBERS_PAGE_SIZE));
  const pagination = (
    <Pagination
      page={page}
      pages={pages}
      hrefFor={(target) => membersHref({ q, role, state, category, page: target })}
      messages={messages}
    />
  );
  if (data.users.length === 0) {
    return (
      <>
        <MembersEmpty
          q={q}
          filtered={Boolean(role || category || state !== "active")}
          messages={messages}
        />
        {pagination}
      </>
    );
  }

  return (
    <>
      <MembersTable rows={data.users} locale={locale} timeZone={timeZone} messages={messages} />
      <MembersCards rows={data.users} locale={locale} timeZone={timeZone} messages={messages} />
      {pagination}
    </>
  );
}

function MembersSelects({
  q,
  role,
  state,
  category,
  categories,
  messages,
}: {
  q: string;
  role?: MemberRole;
  state: MemberStateFilter;
  category?: string;
  categories: CategoryOption[];
  messages: TranslationMap;
}) {
  // The selects apply on change: each one keeps the other filters and the query.
  // The state select always has a value (active is the default) and "All" is an
  // explicit `state=all`, never an omitted key. "All categories" is an empty
  // value, so `filterHref` drops `category` from the canonical URL.
  const params: Record<string, string> = {};
  if (q) params.q = q;
  if (role) params.role = role;
  const stateValue = stateParam(state);
  if (stateValue) params.state = stateValue;
  if (category) params.category = category;
  return (
    <>
      <FilterSelect
        id="members-role"
        name="role"
        label={t("Role", messages)}
        value={role ?? ""}
        basePath="/members"
        params={params}
        options={[
          { value: "", label: t("All roles", messages) },
          { value: "super_admin", label: t("Super admin", messages) },
          { value: "admin", label: t("Admin", messages) },
          { value: "user", label: t("User", messages) },
        ]}
      />
      <FilterSelect
        id="members-state"
        name="state"
        label={t("State", messages)}
        value={state}
        basePath="/members"
        params={params}
        options={[
          { value: "active", label: t("Active", messages) },
          { value: "deactivated", label: t("Deactivated", messages) },
          { value: "all", label: t("All states", messages) },
        ]}
      />
      <FilterSelect
        id="members-category"
        name="category"
        label={t("Category", messages)}
        value={category ?? ""}
        basePath="/members"
        params={params}
        options={[
          { value: "", label: t("All categories", messages) },
          ...categories.map((option) => ({ value: option.id, label: option.name })),
        ]}
      />
    </>
  );
}

function MembersFilterForm({
  q,
  role,
  state,
  category,
  categories,
  messages,
}: {
  q: string;
  role?: MemberRole;
  state: MemberStateFilter;
  category?: string;
  categories: CategoryOption[];
  messages: TranslationMap;
}) {
  // The selects and the search share these params, so each change keeps the
  // rest of the filters and restarts the list at its first page.
  const params: Record<string, string> = {};
  if (role) params.role = role;
  const stateValue = stateParam(state);
  if (stateValue) params.state = stateValue;
  if (category) params.category = category;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <SearchInput
        name="q"
        value={q}
        basePath="/members"
        params={params}
        label={t("Search by name or email", messages)}
        placeholder={t("Search", messages)}
        messages={messages}
      />
      <MembersSelects
        q={q}
        role={role}
        state={state}
        category={category}
        categories={categories}
        messages={messages}
      />
      {(q || role || category || state !== "active") && (
        <Link href="/members" className="min-h-11 py-3 text-xs font-semibold text-accent hover:underline">
          {t("Clear filters", messages)}
        </Link>
      )}
    </div>
  );
}

function memberFilters(input: {
  q: string;
  role?: MemberRole;
  state: MemberStateFilter;
  category?: string;
  page: number;
}): Parameters<typeof loadMembers>[0] {
  const filters: Parameters<typeof loadMembers>[0] = {
    state: input.state,
    offset: (input.page - 1) * MEMBERS_PAGE_SIZE,
  };
  if (input.q) filters.q = input.q;
  if (input.role) filters.role = input.role;
  if (input.category) filters.category = input.category;
  return filters;
}

function MembersContent({
  data,
  q,
  role,
  state,
  category,
  page,
  locale,
  timeZone,
  messages,
}: {
  data: Awaited<ReturnType<typeof loadMembers>>;
  q: string;
  role?: MemberRole;
  state: MemberStateFilter;
  category?: string;
  page: number;
  locale: Locale;
  timeZone: string;
  messages: TranslationMap;
}) {
  if (!data.ok) {
    return (
      <PanelError
        error={data}
        heading={t("We couldn't load the members.", messages)}
        retryHref={membersHref({ q, role, state, category, page })}
        messages={messages}
      />
    );
  }
  return (
    <MembersBody
      data={data}
      q={q}
      role={role}
      state={state}
      category={category}
      page={page}
      locale={locale}
      timeZone={timeZone}
      messages={messages}
    />
  );
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<MembersSearchParams> }) {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const timeZone = await loadPanelTimeZone();

  const params = await searchParams;
  const q = (first(params.q) ?? "").trim().slice(0, 100);
  const role = parseRole(first(params.role));
  const state = parseState(first(params.state));
  const category = parseCategory(first(params.category));
  const page = parsePage(first(params.page));
  const [data, categoryList] = await Promise.all([
    loadMembers(memberFilters({ q, role, state, category, page })),
    loadCategories({ offset: 0, limit: 100 }),
  ]);
  // A failed category list never blocks the page: the select still offers
  // "All categories" and every member stays visible.
  const categories: CategoryOption[] = categoryList.ok
    ? categoryList.categories
        .map((row) => ({ id: row.id, name: row.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  // An out-of-range page would otherwise read as "no members" while the
  // instance does have them; send the reader to the last real page instead.
  // Only a page strictly past the last one redirects: a last page that
  // happens to be empty (rows deleted meanwhile) is a real empty result.
  if (data.ok && data.users.length === 0) {
    const pages = Math.max(1, Math.ceil(data.total / MEMBERS_PAGE_SIZE));
    if (page > pages) redirect(membersHref({ q, role, state, category, page: pages }));
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-bold">{t("Members", messages)}</h1>
          <p className="text-xs text-muted-foreground">
            {t("Members of this instance. Filter by name or email.", messages)}
          </p>
        </div>
        <Link
          href="/invitations"
          className="inline-flex min-h-11 items-center rounded-control border border-transparent bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Invite a member", messages)}
        </Link>
      </header>

      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
        <MembersFilterForm
          q={q}
          role={role}
          state={state}
          category={category}
          categories={categories}
          messages={messages}
        />

        <MembersContent
          data={data}
          q={q}
          role={role}
          state={state}
          category={category}
          page={page}
          locale={locale}
          timeZone={timeZone}
          messages={messages}
        />
      </div>
    </section>
  );
}
