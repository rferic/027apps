import type { ReactNode } from "react";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { t } from "@027apps/i18n/t.js";
import { formatDate } from "@/lib/format-date";

/** Public fields of an invitation the page and the form may render. */
export interface InvitePublicView {
  email: string | null;
  name: string | null;
  role: "user" | "admin";
  /** True when the invitation carries no email/name: the form asks for them. */
  requires_identity: boolean;
  role_applies: boolean;
  account_exists: boolean;
  inviter_name: string | null;
  instance_name: string;
  expires_at: string;
  timezone: string;
  locale: Locale;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/**
 * The invitation as a read-only card: the form never asks for data the token
 * already carries, and disabled inputs are not a substitute for a card.
 */
export function InviteDetails({
  view,
  messages,
}: {
  view: InvitePublicView;
  messages: TranslationMap;
}) {
  const role = view.role_applies
    ? view.role === "admin"
      ? t("Administrator", messages)
      : t("Member", messages)
    : t("Your current role", messages);
  return (
    <dl className="grid grid-cols-1 gap-3 rounded-card border border-border bg-muted/40 p-4 sm:grid-cols-2">
      {!view.requires_identity && <Row label={t("Email", messages)}>{view.email}</Row>}
      {!view.requires_identity && <Row label={t("Name", messages)}>{view.name}</Row>}
      <Row label={t("Instance", messages)}>{view.instance_name}</Row>
      <Row label={t("Invited by", messages)}>{view.inviter_name ?? view.instance_name}</Row>
      <Row label={t("Role", messages)}>{role}</Row>
      <Row label={t("Expires", messages)}>
        {formatDate(view.expires_at, { locale: view.locale, timeZone: view.timezone })}
      </Row>
    </dl>
  );
}
