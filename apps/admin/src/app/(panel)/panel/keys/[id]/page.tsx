import Link from "next/link";
import { panelLocale } from "@/lib/panel-locale";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { ApiKeyRevokeButton } from "@/components/api-key-revoke-button";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { apiKeyScopeLabel } from "@/lib/api-key-scopes";
import { formatDate } from "@/lib/format-date";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { loadPanelTimeZone } from "@/lib/panel-settings";
import { requirePanel } from "@/lib/panel-guard";
import { loadKey, type ApiKeyRow } from "@/lib/panel-keys";

/**
 * The page reads the session and the key while rendering; the layout's opt-out
 * is not inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

function kindLabel(kind: ApiKeyRow["kind"], messages: TranslationMap): string {
  return kind === "service" ? t("Service", messages) : t("Delegated", messages);
}

function kindVariant(kind: ApiKeyRow["kind"]): BadgeVariant {
  return kind === "service" ? "success" : "neutral";
}

function ownerLabel(key: ApiKeyRow, messages: TranslationMap): string {
  return key.kind === "service" ? t("Instance", messages) : key.owner;
}

function roleCapLabel(key: ApiKeyRow, messages: TranslationMap): string | null {
  if (key.kind !== "service" || !key.roleCap) return null;
  return key.roleCap === "super_admin"
    ? t("Super administrator", messages)
    : t("Administrator", messages);
}

function KeyBreadcrumb({ name, messages }: { name: string; messages: TranslationMap }) {
  return (
    <nav aria-label={t("Breadcrumb", messages)} className="text-xs text-muted-foreground">
      <Link
        href="/panel/keys"
        className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("API keys", messages)}
      </Link>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{name}</span>
    </nav>
  );
}

function KeyHeader({ apiKey, messages }: { apiKey: ApiKeyRow; messages: TranslationMap }) {
  const revoked = apiKey.revoked_at !== null;
  return (
    <header className="flex flex-wrap items-center gap-2">
      <h1 className="text-base font-bold">{apiKey.name}</h1>
      <Badge variant={kindVariant(apiKey.kind)}>{kindLabel(apiKey.kind, messages)}</Badge>
      <Badge variant={revoked ? "destructive" : "success"}>
        {revoked ? t("Revoked", messages) : t("Active", messages)}
      </Badge>
    </header>
  );
}

function MetaItem({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-[11px]" : "text-xs"}>{children}</dd>
    </div>
  );
}

function KeyDetails({
  apiKey,
  locale,
  timeZone,
  messages,
}: {
  apiKey: ApiKeyRow;
  locale: Locale;
  timeZone: string;
  messages: TranslationMap;
}) {
  const cap = roleCapLabel(apiKey, messages);
  return (
    <section
      aria-labelledby="api-key-details-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="api-key-details-title" className="text-sm font-semibold">
        {t("Details", messages)}
      </h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetaItem label={t("Owner", messages)}>{ownerLabel(apiKey, messages)}</MetaItem>
        {cap && <MetaItem label={t("Role cap", messages)}>{cap}</MetaItem>}
        <MetaItem label={t("Prefix", messages)} mono>
          {apiKey.prefix}
        </MetaItem>
        <MetaItem label={t("Created", messages)}>
          {formatDate(apiKey.created_at, { locale, timeZone })}
        </MetaItem>
        <MetaItem label={t("Expires", messages)}>
          {apiKey.expiresAt ? formatDate(apiKey.expiresAt, { locale, timeZone }) : t("Never", messages)}
        </MetaItem>
        <MetaItem label={t("Last used", messages)}>
          {apiKey.last_used_at
            ? formatDate(apiKey.last_used_at, { locale, timeZone })
            : t("Never", messages)}
        </MetaItem>
      </dl>
    </section>
  );
}

function KeyPermissions({ apiKey, messages }: { apiKey: ApiKeyRow; messages: TranslationMap }) {
  return (
    <section
      aria-labelledby="api-key-permissions-title"
      className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="api-key-permissions-title" className="text-sm font-semibold">
        {t("Permissions", messages)}
      </h2>
      {apiKey.scopes.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {apiKey.scopes.map((scope) => (
            <li key={scope}>
              <span className="inline-flex min-h-7 items-center rounded-full border border-border bg-muted px-2.5 text-xs font-semibold text-foreground">
                {t(apiKeyScopeLabel(scope), messages)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function KeyPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePanel("super_admin");

  const locale = panelLocale(gate.user);
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const timeZone = await loadPanelTimeZone();

  const { id } = await params;
  const result = await loadKey(id);

  // A missing key is a real 404, not a generic load error.
  if (!result.ok && result.code === "not_found") notFound();

  if (!result.ok) {
    return (
      <section className="flex flex-col gap-4">
        <PanelError
          error={result}
          heading={t("We couldn't load this API key.", messages)}
          retryHref={`/panel/keys/${encodeURIComponent(id)}`}
          messages={messages}
        />
      </section>
    );
  }

  const apiKey = result.apiKey;
  return (
    <section className="flex flex-col gap-5">
      <KeyBreadcrumb name={apiKey.name} messages={messages} />
      <KeyHeader apiKey={apiKey} messages={messages} />
      <KeyDetails apiKey={apiKey} locale={locale} timeZone={timeZone} messages={messages} />
      <KeyPermissions apiKey={apiKey} messages={messages} />
      {apiKey.revoked_at === null && (
        <section
          aria-labelledby="api-key-revoke-title"
          className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
        >
          <h2 id="api-key-revoke-title" className="text-sm font-semibold">
            {t("Danger zone", messages)}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/panel/keys/${encodeURIComponent(apiKey.id)}/edit`}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control border border-transparent bg-primary px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t("Edit", messages)}
            </Link>
            <ApiKeyRevokeButton
              id={apiKey.id}
              name={apiKey.name}
              owner={apiKey.kind === "service" ? null : apiKey.owner}
              isOwnKey={apiKey.kind === "delegated" && apiKey.user_id === gate.user.id}
              redirectTo="/panel/keys"
              messages={messages}
            />
          </div>
        </section>
      )}
    </section>
  );
}
