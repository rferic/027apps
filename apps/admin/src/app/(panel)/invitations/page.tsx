import { cookies } from "next/headers";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { InvitationCreateForm } from "@/components/invitation-create-form";
import { InvitationRevokeButton } from "@/components/invitation-revoke-button";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadCategories, loadModuleChoices, type CategoryRow } from "@/lib/panel-categories";
import {
  loadInvitations,
  type InvitationRow,
  type InvitationStatus,
} from "@/lib/panel-invitations";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";

/**
 * The page reads the session while rendering; the layout's opt-out is not
 * inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

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

/** Date only: instance time zone is task-11 debt (M2d), not redefined here. */
function formatDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
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
  categories: Map<string, string>;
  categoriesOk: boolean;
  modules: Map<string, string>;
  messages: TranslationMap;
}

function InvitationsTable({
  rows,
  locale,
  categories,
  categoriesOk,
  modules,
  messages,
}: InvitationsViewProps) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">{t("Invitations", messages)}</caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Email", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Name", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Status", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Category", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Modules", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Expires", messages)}
            </th>
            <th scope="col" className="py-2 font-semibold">
              <span className="sr-only">{t("Actions", messages)}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border align-top">
              <td className="py-2 pr-3 font-semibold">{row.email}</td>
              <td className="py-2 pr-3">{row.name}</td>
              <td className="py-2 pr-3">
                <Badge variant={statusVariant(row.status)}>{statusLabel(row.status, messages)}</Badge>
              </td>
              <td className="py-2 pr-3">{categoryName(row, categories, categoriesOk, messages)}</td>
              <td className="py-2 pr-3">{moduleNames(row, modules)}</td>
              <td className="py-2 pr-3">{formatDate(row.expires_at, locale)}</td>
              <td className="py-2 text-right">
                {row.status === "pending" && (
                  <InvitationRevokeButton
                    id={row.id}
                    name={row.name}
                    email={row.email}
                    messages={messages}
                  />
                )}
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
  categories,
  categoriesOk,
  modules,
  messages,
}: InvitationsViewProps) {
  return (
    <ul className="flex flex-col gap-2 sm:hidden">
      {rows.map((row) => (
        <li key={row.id} className="rounded-card border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{row.email}</span>
            <Badge variant={statusVariant(row.status)}>{statusLabel(row.status, messages)}</Badge>
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t("Name", messages)}</dt>
            <dd>{row.name}</dd>
            <dt className="text-muted-foreground">{t("Category", messages)}</dt>
            <dd>{categoryName(row, categories, categoriesOk, messages)}</dd>
            <dt className="text-muted-foreground">{t("Modules", messages)}</dt>
            <dd>{moduleNames(row, modules)}</dd>
            <dt className="text-muted-foreground">{t("Expires", messages)}</dt>
            <dd>{formatDate(row.expires_at, locale)}</dd>
          </dl>
          {row.status === "pending" && (
            <div className="mt-2">
              <InvitationRevokeButton
                id={row.id}
                name={row.name}
                email={row.email}
                messages={messages}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function InvitationsEmpty({ messages }: { messages: TranslationMap }) {
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

export default async function InvitationsPage() {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const [invitations, categories, moduleChoices] = await Promise.all([
    loadInvitations(),
    loadCategories(),
    loadModuleChoices(),
  ]);

  const categoryRows = readCategories(categories);
  const categoryNames = new Map(categoryRows.map((category) => [category.id, category.name]));
  const moduleNames = new Map(
    (moduleChoices.ok ? moduleChoices.modules : []).map((module) => [module.key, module.name]),
  );

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-bold">{t("Invitations", messages)}</h1>
          <p className="text-xs text-muted-foreground">
            {t("Invitations you have created.", messages)}
          </p>
        </div>
        <InvitationCreateForm
          categories={categoryRows.map((category) => ({ id: category.id, name: category.name }))}
          modules={moduleChoices.ok ? moduleChoices.modules : []}
          optionsUnavailable={!categories.ok || !moduleChoices.ok}
          messages={messages}
        />
      </header>

      {invitations.ok ? (
        invitations.invitations.length === 0 ? (
          <InvitationsEmpty messages={messages} />
        ) : (
          <>
            <InvitationsTable
              rows={invitations.invitations}
              locale={locale}
              categories={categoryNames}
              categoriesOk={categories.ok}
              modules={moduleNames}
              messages={messages}
            />
            <InvitationsCards
              rows={invitations.invitations}
              locale={locale}
              categories={categoryNames}
              categoriesOk={categories.ok}
              modules={moduleNames}
              messages={messages}
            />
          </>
        )
      ) : (
        <PanelError
          error={invitations}
          heading={t("We couldn't load the invitations.", messages)}
          retryHref="/invitations"
          messages={messages}
        />
      )}
    </section>
  );
}
