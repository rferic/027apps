import Link from "next/link";
import { panelLocale } from "@/lib/panel-locale";
import { notFound } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { MemberDangerZone } from "@/components/member-danger-zone";
import { MemberProfileForm } from "@/components/member-profile-form";
import { MemberPurgeAction } from "@/components/member-purge-action";
import { MemberRestoreAction } from "@/components/member-restore-action";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-date";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { loadPanelTimeZone } from "@/lib/panel-settings";
import { requirePanel } from "@/lib/panel-guard";
import { loadMember, type MemberDetail } from "@/lib/panel-members";

/**
 * The page reads the session and the member while rendering; the layout's
 * opt-out is not inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

function roleVariant(role: MemberDetail["role"]): BadgeVariant {
  switch (role) {
    case "super_admin":
      return "destructive";
    case "admin":
      return "success";
    default:
      return "neutral";
  }
}

function roleLabel(role: MemberDetail["role"], messages: TranslationMap): string {
  switch (role) {
    case "super_admin":
      return t("Super admin", messages);
    case "admin":
      return t("Admin", messages);
    default:
      return t("User", messages);
  }
}

function memberName(member: MemberDetail): string {
  return member.display_name || member.email || member.id;
}

function memberEmail(member: MemberDetail, messages: TranslationMap): string {
  if (member.emailUnavailable) return t("Email unavailable", messages);
  return member.email ?? "—";
}

function MemberBreadcrumb({ name, messages }: { name: string; messages: TranslationMap }) {
  return (
    <nav aria-label={t("Breadcrumb", messages)} className="text-xs text-muted-foreground">
      <Link href="/members" className="font-semibold text-accent hover:underline">
        {t("Members", messages)}
      </Link>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{name}</span>
    </nav>
  );
}

function MemberHeader({
  member,
  locale,
  timeZone,
  messages,
}: {
  member: MemberDetail;
  locale: Locale;
  timeZone: string;
  messages: TranslationMap;
}) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-base font-bold">{memberName(member)}</h1>
      <span className="flex flex-wrap items-center gap-1">
        <Badge variant={roleVariant(member.role)}>{roleLabel(member.role, messages)}</Badge>
        <Badge variant={member.deactivated_at === null ? "success" : "destructive"}>
          {member.deactivated_at === null ? t("Active", messages) : t("Deactivated", messages)}
        </Badge>
      </span>
      <p className="text-xs text-muted-foreground">{memberEmail(member, messages)}</p>
      <p className="text-xs text-muted-foreground">
        {t("Joined", messages)}: {formatDate(member.created_at, { locale, timeZone })}
      </p>
    </header>
  );
}

function MemberCategories({
  member,
  messages,
}: {
  member: MemberDetail;
  messages: TranslationMap;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">{t("Categories", messages)}</h2>
      {member.categories.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("No categories assigned.", messages)}{" "}
          <Link href="/categories" className="font-semibold text-accent hover:underline">
            {t("Categories", messages)}
          </Link>
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {member.categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/categories/${category.id}`}
                className="inline-flex min-h-7 items-center rounded-full border border-border bg-muted px-2.5 text-xs font-semibold text-foreground hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePanel("admin");

  const locale = panelLocale(gate.user);
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const timeZone = await loadPanelTimeZone();

  const { id } = await params;
  const result = await loadMember(id);

  // A missing member is a real 404, not a generic load error.
  if (!result.ok && result.code === "not_found") notFound();

  if (!result.ok) {
    return (
      <section className="flex flex-col gap-4">
        <PanelError
          error={result}
          heading={t("We couldn't load this member.", messages)}
          retryHref={`/members/${encodeURIComponent(id)}`}
          messages={messages}
        />
      </section>
    );
  }

  const member = result.member;
  const isSelf = gate.user.id === member.id;
  return (
    <section className="flex flex-col gap-5">
      <MemberBreadcrumb name={memberName(member)} messages={messages} />
      <MemberHeader member={member} locale={locale} timeZone={timeZone} messages={messages} />
      <MemberCategories member={member} messages={messages} />
      <MemberProfileForm
        member={member}
        viewerRole={gate.user.role}
        isSelf={isSelf}
        messages={messages}
      />
      {gate.user.role === "super_admin" ? (
        member.deactivated_at !== null ? (
          <div className="flex flex-col gap-4">
            <MemberRestoreAction id={member.id} name={memberName(member)} messages={messages} />
            <MemberPurgeAction
              id={member.id}
              name={memberName(member)}
              isSelf={isSelf}
              messages={messages}
            />
          </div>
        ) : (
          <MemberDangerZone
            id={member.id}
            name={memberName(member)}
            isSelf={isSelf}
            messages={messages}
          />
        )
      ) : null}
    </section>
  );
}
