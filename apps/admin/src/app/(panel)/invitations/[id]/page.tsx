import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { InvitationRevokeButton } from "@/components/invitation-revoke-button";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { formatDate } from "@/lib/format-date";
import {
  loadCategory,
  loadModuleChoices,
  type CategoryDetailResult,
  type ModuleChoice,
} from "@/lib/panel-categories";
import {
  loadInvitation,
  type InvitationDetail,
  type InvitationStatus,
} from "@/lib/panel-invitations";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { loadPanelTimeZone } from "@/lib/panel-settings";
import { requirePanel } from "@/lib/panel-guard";

/**
 * The page reads the session and the invitation while rendering; the layout's
 * opt-out is not inherited, so this segment opts out of the static shell too.
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

function InvitationBreadcrumb({ email, messages }: { email: string; messages: TranslationMap }) {
  return (
    <nav aria-label={t("Breadcrumb", messages)} className="text-xs text-muted-foreground">
      <Link
        href="/invitations"
        className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("Invitations", messages)}
      </Link>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{email}</span>
    </nav>
  );
}

function InvitationHeader({
  invitation,
  messages,
}: {
  invitation: InvitationDetail;
  messages: TranslationMap;
}) {
  return (
    <header className="flex flex-wrap items-center gap-2">
      <h1 className="text-base font-bold">{invitation.email}</h1>
      <Badge variant={statusVariant(invitation.status)}>
        {statusLabel(invitation.status, messages)}
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

function CategoryValue({
  categoryId,
  category,
  messages,
}: {
  categoryId: string | null;
  category: CategoryDetailResult | null;
  messages: TranslationMap;
}) {
  if (!categoryId) return "—";
  if (!category) return "—";
  if (!category.ok) return t("Category unavailable", messages);
  return (
    <Link
      href={`/categories/${encodeURIComponent(category.category.id)}`}
      className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {category.category.name}
    </Link>
  );
}

function ModulesValue({
  keys,
  modules,
}: {
  keys: string[];
  modules: ModuleChoice[];
}) {
  if (keys.length === 0) return "—";
  const names = new Map(modules.map((module) => [module.key, module.name]));
  return (
    <ul className="flex flex-col gap-0.5">
      {keys.map((key) => (
        <li key={key}>{names.get(key) ?? key}</li>
      ))}
    </ul>
  );
}

function InvitationDetails({
  invitation,
  category,
  modules,
  locale,
  timeZone,
  messages,
}: {
  invitation: InvitationDetail;
  category: CategoryDetailResult | null;
  modules: ModuleChoice[];
  locale: Locale;
  timeZone: string;
  messages: TranslationMap;
}) {
  const creator = invitation.created_by
    ? invitation.created_by.display_name
    : t("Instance", messages);
  return (
    <section
      aria-labelledby="invitation-details-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="invitation-details-title" className="text-sm font-semibold">
        {t("Details", messages)}
      </h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetaItem label={t("Name", messages)}>{invitation.name}</MetaItem>
        <MetaItem label={t("Category", messages)}>
          <CategoryValue
            categoryId={invitation.user_category_id}
            category={category}
            messages={messages}
          />
        </MetaItem>
        <MetaItem label={t("Modules", messages)}>
          <ModulesValue keys={invitation.modules} modules={modules} />
        </MetaItem>
        <MetaItem label={t("Expires", messages)}>
          {formatDate(invitation.expires_at, { locale, timeZone })}
        </MetaItem>
        <MetaItem label={t("Created", messages)}>
          {formatDate(invitation.created_at, { locale, timeZone })}
        </MetaItem>
        <MetaItem label={t("Created by", messages)}>{creator}</MetaItem>
        {invitation.used_at && (
          <MetaItem label={t("Used", messages)}>
            {formatDate(invitation.used_at, { locale, timeZone })}
          </MetaItem>
        )}
        {invitation.revoked_at && (
          <MetaItem label={t("Revoked", messages)}>
            {formatDate(invitation.revoked_at, { locale, timeZone })}
          </MetaItem>
        )}
      </dl>
    </section>
  );
}

function InvitationDangerZone({
  invitation,
  messages,
}: {
  invitation: InvitationDetail;
  messages: TranslationMap;
}) {
  return (
    <section aria-labelledby="invitation-revoke-title" className="flex flex-col gap-2">
      <h2 id="invitation-revoke-title" className="text-sm font-semibold">
        {t("Danger zone", messages)}
      </h2>
      <p className="text-xs text-muted-foreground">
        {t(
          "The invitation link is only shown once, when the invitation is created. The invitee opens it in the browser or in the mobile app.",
          messages,
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("If you lost it, revoke this invitation and create a new one.", messages)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <InvitationRevokeButton
          id={invitation.id}
          name={invitation.name}
          email={invitation.email}
          redirectTo="/invitations"
          messages={messages}
        />
      </div>
    </section>
  );
}

export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const { id } = await params;
  const detail = await loadInvitation(id);

  // A missing invitation is a real 404, not a generic load error.
  if (!detail.ok && detail.code === "not_found") notFound();

  if (!detail.ok) {
    return (
      <section className="flex flex-col gap-4">
        <PanelError
          error={detail}
          heading={t("We couldn't load this invitation.", messages)}
          retryHref={`/invitations/${encodeURIComponent(id)}`}
          messages={messages}
        />
      </section>
    );
  }

  const invitation = detail.invitation;
  const [category, moduleChoices] = await Promise.all([
    invitation.user_category_id
      ? loadCategory(invitation.user_category_id)
      : Promise.resolve(null),
    loadModuleChoices(),
  ]);

  const timeZone = await loadPanelTimeZone();

  return (
    <section className="flex flex-col gap-5">
      <InvitationBreadcrumb email={invitation.email} messages={messages} />
      <InvitationHeader invitation={invitation} messages={messages} />
      <InvitationDetails
        invitation={invitation}
        category={category}
        modules={moduleChoices.ok ? moduleChoices.modules : []}
        locale={locale}
        timeZone={timeZone}
        messages={messages}
      />
      {invitation.status === "pending" && (
        <InvitationDangerZone invitation={invitation} messages={messages} />
      )}
    </section>
  );
}
