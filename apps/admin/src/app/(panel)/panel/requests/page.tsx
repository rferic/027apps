import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { panelLocale } from "@/lib/panel-locale";
import { InvitationRequestActions } from "@/components/invitation-request-actions";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-date";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { loadPanelTimeZone } from "@/lib/panel-settings";
import { requirePanel } from "@/lib/panel-guard";
import {
  loadInvitationRequests,
  type InvitationRequestRow,
  type InvitationRequestState,
} from "@/lib/invitation-requests";

/**
 * The page reads the session and the requests while rendering; the layout's
 * opt-out is not inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

function stateVariant(state: InvitationRequestState): BadgeVariant {
  switch (state) {
    case "pending":
      return "success";
    case "approved":
      return "neutral";
    default:
      return "destructive";
  }
}

function stateLabel(state: InvitationRequestState, messages: TranslationMap): string {
  switch (state) {
    case "pending":
      return t("Pending", messages);
    case "approved":
      return t("Approved", messages);
    case "rejected":
      return t("Rejected", messages);
    default:
      return t("Cancelled", messages);
  }
}

/** Live quota in the mockup's compact `used/total` form (total = base + granted). */
function quotaLabel(row: InvitationRequestRow): string {
  return `${row.quota.used}/${row.quota.base + row.quota.granted}`;
}

function requesterName(row: InvitationRequestRow): string {
  return row.requester.display_name || row.requester.id;
}

function levelLabel(row: InvitationRequestRow, messages: TranslationMap): string {
  if (row.requester.level === null) return t("None", messages);
  return t("Level {level}", messages, { level: row.requester.level });
}

function RequestsTable({
  rows,
  locale,
  timeZone,
  messages,
}: {
  rows: InvitationRequestRow[];
  locale: Locale;
  timeZone: string;
  messages: TranslationMap;
}) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-separate border-spacing-0 text-left text-xs">
        <caption className="sr-only">{t("Requests", messages)}</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Requester", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Level", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Asks", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Reason", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Quota", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 font-semibold">
              <span className="sr-only">{t("Actions", messages)}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="border-b border-border py-2 pr-3">
                <span className="font-semibold">{requesterName(row)}</span>
                <span className="mt-0.5 block text-muted-foreground">
                  {formatDate(row.created_at, { locale, timeZone })}
                </span>
              </td>
              <td className="border-b border-border py-2 pr-3">{levelLabel(row, messages)}</td>
              <td className="border-b border-border py-2 pr-3">
                <strong>{row.amount}</strong>
              </td>
              <td className="border-b border-border py-2 pr-3 text-muted-foreground">
                {row.reason ?? "—"}
              </td>
              <td className="border-b border-border py-2 pr-3 font-mono">{quotaLabel(row)}</td>
              <td className="border-b border-border py-2">
                {row.state === "pending" ? (
                  <InvitationRequestActions id={row.id} amount={row.amount} messages={messages} />
                ) : (
                  <Badge variant={stateVariant(row.state)}>{stateLabel(row.state, messages)}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestsCards({
  rows,
  messages,
}: {
  rows: InvitationRequestRow[];
  messages: TranslationMap;
}) {
  return (
    <ul className="flex flex-col gap-2 sm:hidden">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{requesterName(row)}</span>
            <Badge variant={stateVariant(row.state)}>{stateLabel(row.state, messages)}</Badge>
          </span>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t("Level", messages)}</dt>
            <dd>{levelLabel(row, messages)}</dd>
            <dt className="text-muted-foreground">{t("Asks", messages)}</dt>
            <dd>{row.amount}</dd>
            <dt className="text-muted-foreground">{t("Reason", messages)}</dt>
            <dd>{row.reason ?? "—"}</dd>
            <dt className="text-muted-foreground">{t("Quota", messages)}</dt>
            <dd>{quotaLabel(row)}</dd>
          </dl>
          {row.state === "pending" && (
            <InvitationRequestActions id={row.id} amount={row.amount} messages={messages} />
          )}
        </li>
      ))}
    </ul>
  );
}

function RequestsEmpty({ messages }: { messages: TranslationMap }) {
  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">{t("No requests yet.", messages)}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("When a member runs out of seats, their request appears here.", messages)}
      </p>
    </div>
  );
}

export default async function RequestsPage() {
  const gate = await requirePanel("admin");

  const locale = panelLocale(gate.user);
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const timeZone = await loadPanelTimeZone();
  const data = await loadInvitationRequests({ offset: 0 });

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-bold">{t("Requests", messages)}</h1>
        <p className="text-xs text-muted-foreground">
          {t("Pending first. Approving adds permanent, revocable seats to that person.", messages)}
        </p>
      </header>

      {!data.ok ? (
        <PanelError
          error={data}
          heading={t("We couldn't load the requests.", messages)}
          retryHref="/panel/requests"
          messages={messages}
        />
      ) : data.requests.length === 0 ? (
        <RequestsEmpty messages={messages} />
      ) : (
        <>
          <RequestsTable rows={data.requests} locale={locale} timeZone={timeZone} messages={messages} />
          <RequestsCards rows={data.requests} messages={messages} />
        </>
      )}
    </section>
  );
}
