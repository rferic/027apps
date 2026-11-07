import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { MemberError } from "@/components/member-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import {
  loadMembers,
  MEMBERS_PAGE_SIZE,
  type MemberListSuccess,
  type MemberRow,
} from "@/lib/panel-members";

/**
 * The page reads the session while rendering; the layout's opt-out is not
 * inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

interface MembersSearchParams {
  q?: string | string[];
  page?: string | string[];
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** 1-based page from the query; anything invalid falls back to the first page. */
function parsePage(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

function membersHref(input: { q: string; page: number }): string {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
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

function formatJoined(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function MemberBadges({ row, messages }: { row: MemberRow; messages: TranslationMap }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge variant={roleVariant(row.role)}>{roleLabel(row.role, messages)}</Badge>
      <Badge variant={statusVariant(row)}>{statusLabel(row, messages)}</Badge>
    </span>
  );
}

function MembersTable({ rows, locale, messages }: { rows: MemberRow[]; locale: Locale; messages: TranslationMap }) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">{t("Members", messages)}</caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Name", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Email", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Role", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Status", messages)}
            </th>
            <th scope="col" className="py-2 font-semibold">
              {t("Joined", messages)}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="relative border-b border-border">
              <td className="py-2 pr-3 font-semibold">
                <Link
                  href={`/members/${row.id}`}
                  className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {row.display_name || row.email || row.id}
                </Link>
              </td>
              <td className="py-2 pr-3">{emailLabel(row, messages)}</td>
              <td className="py-2 pr-3">
                <Badge variant={roleVariant(row.role)}>{roleLabel(row.role, messages)}</Badge>
              </td>
              <td className="py-2 pr-3">
                <Badge variant={statusVariant(row)}>{statusLabel(row, messages)}</Badge>
              </td>
              <td className="py-2">{formatJoined(row.created_at, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MembersCards({ rows, locale, messages }: { rows: MemberRow[]; locale: Locale; messages: TranslationMap }) {
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
            <span className="text-xs text-muted-foreground">
              {t("Joined", messages)}: {formatJoined(row.created_at, locale)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Pagination({
  q,
  page,
  pages,
  messages,
}: {
  q: string;
  page: number;
  pages: number;
  messages: TranslationMap;
}) {
  if (pages <= 1) return null;
  const linkClass =
    "inline-flex min-h-11 items-center rounded-control font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const disabledClass = "text-muted-foreground";

  return (
    <nav aria-label={t("Pagination", messages)} className="flex items-center justify-between gap-3 text-xs">
      {page > 1 ? (
        <Link href={membersHref({ q, page: page - 1 })} className={linkClass}>
          {t("Previous", messages)}
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          {t("Previous", messages)}
        </span>
      )}
      <span className="text-muted-foreground">
        {t("Page {page} of {pages}", messages, { page, pages })}
      </span>
      {page < pages ? (
        <Link href={membersHref({ q, page: page + 1 })} className={linkClass}>
          {t("Next", messages)}
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          {t("Next", messages)}
        </span>
      )}
    </nav>
  );
}

function MembersEmpty({ q, messages }: { q: string; messages: TranslationMap }) {
  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">
        {q ? t("No members match {q}.", messages, { q }) : t("No members yet.", messages)}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("Invite someone to give them access to this instance.", messages)}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-accent">
        <Link href="/invitations" className="hover:underline">
          {t("Invite a member", messages)}
        </Link>
        {q && (
          <Link href="/members" className="hover:underline">
            {t("Clear search", messages)}
          </Link>
        )}
      </div>
    </div>
  );
}

function MembersBody({
  data,
  q,
  page,
  locale,
  messages,
}: {
  data: MemberListSuccess;
  q: string;
  page: number;
  locale: Locale;
  messages: TranslationMap;
}) {
  const pages = Math.max(1, Math.ceil(data.total / MEMBERS_PAGE_SIZE));
  if (data.users.length === 0) return <MembersEmpty q={q} messages={messages} />;

  return (
    <>
      <MembersTable rows={data.users} locale={locale} messages={messages} />
      <MembersCards rows={data.users} locale={locale} messages={messages} />
      <Pagination q={q} page={page} pages={pages} messages={messages} />
    </>
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

  const params = await searchParams;
  const q = (first(params.q) ?? "").trim().slice(0, 100);
  const page = parsePage(first(params.page));
  const data = await loadMembers({ ...(q ? { q } : {}), offset: (page - 1) * MEMBERS_PAGE_SIZE });

  // An out-of-range page would otherwise read as "no members" while the
  // instance does have them; send the reader to the last real page instead.
  // Only a page strictly past the last one redirects: a last page that
  // happens to be empty (rows deleted meanwhile) is a real empty result.
  if (data.ok && data.users.length === 0) {
    const pages = Math.max(1, Math.ceil(data.total / MEMBERS_PAGE_SIZE));
    if (page > pages) redirect(membersHref({ q, page: pages }));
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

      <form method="get" className="flex flex-wrap items-end gap-2" role="search">
        <label htmlFor="members-q" className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("Search by name or email", messages)}
          <input
            id="members-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={100}
            className="min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-control border border-border bg-muted px-3 text-xs font-semibold text-foreground hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Search", messages)}
        </button>
      </form>

      {data.ok ? (
        <MembersBody data={data} q={q} page={page} locale={locale} messages={messages} />
      ) : (
        <MemberError
          error={data}
          heading={t("We couldn't load the members.", messages)}
          retryHref={membersHref({ q, page })}
          messages={messages}
        />
      )}
    </section>
  );
}
