import { cookies } from "next/headers";
import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { ApiKeyCreateForm } from "@/components/api-key-create-form";
import { ApiKeyRevokeButton } from "@/components/api-key-revoke-button";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import { loadApiKeys, type ApiKeyKind, type ApiKeyRow } from "@/lib/panel-keys";

/**
 * The page reads the session while rendering; the layout's opt-out is not
 * inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

type StateFilter = "all" | "active" | "revoked";

interface KeysSearchParams {
  state?: string | string[];
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilter(value: string | undefined): StateFilter {
  return value === "active" || value === "revoked" ? value : "all";
}

function filterKeys(rows: ApiKeyRow[], filter: StateFilter): ApiKeyRow[] {
  if (filter === "active") return rows.filter((row) => row.revoked_at === null);
  if (filter === "revoked") return rows.filter((row) => row.revoked_at !== null);
  return rows;
}

function formatDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function kindLabel(kind: ApiKeyKind, messages: TranslationMap): string {
  return kind === "service" ? t("Service", messages) : t("Delegated", messages);
}

function kindVariant(kind: ApiKeyKind): BadgeVariant {
  return kind === "service" ? "success" : "neutral";
}

function ownerLabel(row: ApiKeyRow, messages: TranslationMap): string {
  return row.kind === "service" ? t("Instance", messages) : row.owner;
}

function roleCapLabel(row: ApiKeyRow, messages: TranslationMap): string | null {
  if (!row.roleCap) return null;
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

function revokeHref(filter: StateFilter): string {
  return filter === "all" ? "/keys" : `/keys?state=${filter}`;
}

function KeysFilter({ filter, messages }: { filter: StateFilter; messages: TranslationMap }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <label htmlFor="keys-state" className="flex flex-col gap-1 text-xs font-semibold">
          {t("Status", messages)}
          <select
            id="keys-state"
            name="state"
            defaultValue={filter}
            className="min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="all">{t("All", messages)}</option>
            <option value="active">{t("Active", messages)}</option>
            <option value="revoked">{t("Revoked", messages)}</option>
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-control border border-border bg-muted px-2.5 text-xs font-semibold text-foreground hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Apply", messages)}
        </button>
      </form>
      {filter !== "all" && (
        <Link
          href="/keys"
          className="min-h-11 py-3 text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Clear filter", messages)}
        </Link>
      )}
    </div>
  );
}

interface KeysViewProps {
  rows: ApiKeyRow[];
  locale: Locale;
  currentUserId: string;
  messages: TranslationMap;
}

function scopesText(row: ApiKeyRow): string {
  return row.scopes.length > 0 ? row.scopes.join(", ") : "—";
}

function RevokeCell({ row, currentUserId, messages }: Omit<KeysViewProps, "rows" | "locale"> & { row: ApiKeyRow }) {
  if (row.revoked_at !== null) return <span className="text-muted-foreground">{t("Revoked", messages)}</span>;
  return (
    <ApiKeyRevokeButton
      id={row.id}
      name={row.name}
      owner={row.kind === "service" ? null : row.owner}
      isOwnKey={row.kind === "delegated" && row.user_id === currentUserId}
      messages={messages}
    />
  );
}

function KeysTable({ rows, locale, currentUserId, messages }: KeysViewProps) {
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
              {t("Prefix", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Requested scopes", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Created", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Expires", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Last used", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Status", messages)}
            </th>
            <th scope="col" className="py-2 font-semibold">
              <span className="sr-only">{t("Actions", messages)}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border align-top">
              <td className="py-2 pr-3 font-semibold">{row.name}</td>
              <td className="py-2 pr-3">
                <Badge variant={kindVariant(row.kind)}>{kindLabel(row.kind, messages)}</Badge>
              </td>
              <td className="py-2 pr-3">
                <OwnerCell row={row} messages={messages} />
              </td>
              <td className="py-2 pr-3 font-mono text-[11px]">{row.prefix}</td>
              <td className="py-2 pr-3 font-mono text-[11px]">{scopesText(row)}</td>
              <td className="py-2 pr-3">{formatDate(row.created_at, locale)}</td>
              <td className="py-2 pr-3">
                {row.expiresAt ? formatDate(row.expiresAt, locale) : t("Never", messages)}
              </td>
              <td className="py-2 pr-3">
                {row.last_used_at ? formatDate(row.last_used_at, locale) : t("Never", messages)}
              </td>
              <td className="py-2 pr-3">
                <Badge variant={row.revoked_at ? "destructive" : "success"}>
                  {row.revoked_at ? t("Revoked", messages) : t("Active", messages)}
                </Badge>
              </td>
              <td className="py-2 text-right">
                <RevokeCell
                  row={row}
                  currentUserId={currentUserId}
                  messages={messages}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeysCards({ rows, locale, currentUserId, messages }: KeysViewProps) {
  return (
    <ul className="flex flex-col gap-2 sm:hidden">
      {rows.map((row) => (
        <li key={row.id} className="rounded-card border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{row.name}</span>
            <Badge variant={kindVariant(row.kind)}>{kindLabel(row.kind, messages)}</Badge>
            <Badge variant={row.revoked_at ? "destructive" : "success"}>
              {row.revoked_at ? t("Revoked", messages) : t("Active", messages)}
            </Badge>
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t("Owner", messages)}</dt>
            <dd>
              <OwnerCell row={row} messages={messages} />
            </dd>
            <dt className="text-muted-foreground">{t("Prefix", messages)}</dt>
            <dd className="font-mono text-[11px]">{row.prefix}</dd>
            <dt className="text-muted-foreground">{t("Requested scopes", messages)}</dt>
            <dd className="font-mono text-[11px]">{scopesText(row)}</dd>
            <dt className="text-muted-foreground">{t("Created", messages)}</dt>
            <dd>{formatDate(row.created_at, locale)}</dd>
            <dt className="text-muted-foreground">{t("Expires", messages)}</dt>
            <dd>{row.expiresAt ? formatDate(row.expiresAt, locale) : t("Never", messages)}</dd>
            <dt className="text-muted-foreground">{t("Last used", messages)}</dt>
            <dd>{row.last_used_at ? formatDate(row.last_used_at, locale) : t("Never", messages)}</dd>
          </dl>
          <div className="mt-2">
            <RevokeCell row={row} currentUserId={currentUserId} messages={messages} />
          </div>
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
          href={revokeHref("all")}
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

export default async function KeysPage({
  searchParams,
}: {
  searchParams: Promise<KeysSearchParams>;
}) {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const params = await searchParams;
  const filter = parseFilter(first(params.state));
  const data = await loadApiKeys();
  const rows = data.ok ? filterKeys(data.apiKeys, filter) : [];

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-bold">{t("API keys", messages)}</h1>
          <p className="text-xs text-muted-foreground">
            {t("Credentials for integrations and automated clients.", messages)}
          </p>
        </div>
        <ApiKeyCreateForm
          canCreateService={gate.user.role === "super_admin"}
          messages={messages}
        />
      </header>

      {data.ok ? (
        <>
          <KeysFilter filter={filter} messages={messages} />
          {rows.length === 0 ? (
            <KeysEmpty
              filtered={filter !== "all" && data.apiKeys.length > 0}
              messages={messages}
            />
          ) : (
            <>
              <KeysTable
                rows={rows}
                locale={locale}
                currentUserId={gate.user.id}
                messages={messages}
              />
              <KeysCards
                rows={rows}
                locale={locale}
                currentUserId={gate.user.id}
                messages={messages}
              />
            </>
          )}
        </>
      ) : (
        <PanelError
          error={data}
          heading={t("We couldn't load the API keys.", messages)}
          retryHref={revokeHref(filter)}
          messages={messages}
        />
      )}
    </section>
  );
}
