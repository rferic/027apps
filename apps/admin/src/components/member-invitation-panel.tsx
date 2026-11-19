"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { formatDate } from "@/lib/format-date";
import type { InvitationGrant, InvitationQuota } from "@/lib/invitation-grants";
import { revokeInvitationGrant, setMemberInvitationLevel } from "@/lib/member-mutations";
import type { MemberRole } from "@/lib/panel-members";

const inputClass =
  "min-h-9 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const buttonClass =
  "inline-flex min-h-9 items-center rounded-control border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const MAX_LEVEL = 20;

function grantLabel(amount: number, messages: TranslationMap): string {
  return t("+{amount} seat(s)", messages, { amount });
}

/** Only a member with a level can run out of seats; a null level means "not assigned". */
function hasNoSeats(level: number | null, remaining: number): boolean {
  return level !== null && remaining === 0;
}

/**
 * The member ficha's invitation panel (mockup §7.5): the live quota (level,
 * base + granted, used + reserved, remaining), the level selector for members,
 * and the grants list with a revoke action. An administrator has no level and
 * invites without a quota; a member with no level shows the warning and an
 * assign action. Every mutation goes through the real users/grants endpoints
 * and the page is revalidated afterwards.
 */
export function MemberInvitationPanel({
  member,
  quota,
  grants,
  locale,
  timeZone,
  messages,
}: {
  member: { id: string; role: MemberRole; invitation_level: number | null };
  quota: InvitationQuota;
  grants: InvitationGrant[];
  locale: Locale;
  timeZone: string;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const isAdmin = member.role === "admin" || member.role === "super_admin";
  const [level, setLevel] = useState<number>(member.invitation_level ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveLevel() {
    setSaving(true);
    setError(null);
    const result = await setMemberInvitationLevel(member.id, level);
    setSaving(false);
    if (!result.ok) {
      setError(t("We couldn't save the level.", messages));
      return;
    }
    router.refresh();
  }

  async function revoke(grantId: string) {
    setSaving(true);
    setError(null);
    const result = await revokeInvitationGrant(member.id, grantId);
    setSaving(false);
    if (!result.ok) {
      setError(t("We couldn't revoke that grant.", messages));
      return;
    }
    router.refresh();
  }

  return (
    <section
      aria-labelledby="member-invitation-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="member-invitation-title" className="text-sm font-semibold">
        {t("Invitation quota", messages)}
      </h2>

      {isAdmin ? (
        <p className="text-xs text-muted-foreground">
          {t("Administrators invite without a quota.", messages)}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-foreground">
            {t("Base {base} + {granted} granted", messages, {
              base: quota.base,
              granted: quota.granted,
            })}
            {" · "}
            {t("{used} used + {reserved} reserved", messages, {
              used: quota.used,
              reserved: quota.reserved,
            })}
            {" · "}
            {t("{remaining} remaining", messages, { remaining: quota.remaining })}
          </p>

          {hasNoSeats(member.invitation_level, quota.remaining) && (
            <p role="status" className="text-xs font-semibold text-warning">
              {t("No seats left. Ask the administrator for more.", messages)}
            </p>
          )}

          {member.invitation_level === null && (
            <p role="status" className="text-xs font-semibold text-warning">
              {t("This member has no level, so they cannot invite anyone.", messages)}
            </p>
          )}

          <div className="flex items-center gap-2">
            <label htmlFor="member-invitation-level" className="text-xs font-semibold">
              {t("Level", messages)}
            </label>
            <select
              id="member-invitation-level"
              value={level}
              disabled={saving}
              onChange={(event) => setLevel(Number(event.target.value))}
              className={inputClass}
            >
              {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((option) => (
                <option key={option} value={option}>
                  {t("Level {level}", messages, { level: option })}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void saveLevel()} disabled={saving} className={buttonClass}>
              {saving
                ? t("Saving…", messages)
                : member.invitation_level === null
                  ? t("Assign level", messages)
                  : t("Save", messages)}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground">{t("Grants", messages)}</h3>
        {grants.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("No grants yet.", messages)}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {grants.map((grant) => (
              <li key={grant.id} className="flex flex-wrap items-center gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0">
                <span className="text-xs font-semibold">{grantLabel(grant.amount, messages)}</span>
                <span className="text-xs text-muted-foreground">
                  {grant.granted_by?.display_name ?? t("Unknown", messages)}
                  {" · "}
                  {formatDate(grant.created_at, { locale, timeZone })}
                </span>
                {grant.revoked_at !== null ? (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t("Revoked", messages)}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void revoke(grant.id)}
                    className={buttonClass}
                  >
                    {t("Revoke", messages)}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
