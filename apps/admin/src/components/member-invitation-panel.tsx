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

/** The live quota line plus the two warnings a member ficha can show. */
function QuotaLines({
  level,
  quota,
  messages,
}: {
  level: number | null;
  quota: InvitationQuota;
  messages: TranslationMap;
}) {
  return (
    <>
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

      {hasNoSeats(level, quota.remaining) && (
        <p role="status" className="text-xs font-semibold text-warning">
          {t("No seats left. Ask the administrator for more.", messages)}
        </p>
      )}

      {level === null && (
        <p role="status" className="text-xs font-semibold text-warning">
          {t("This member has no level, so they cannot invite anyone.", messages)}
        </p>
      )}
    </>
  );
}

/**
 * The level field. A local draft keeps the field empty while it is being
 * retyped instead of snapping back to the saved level on every keystroke; only
 * 1..20 counts as a value, so an out-of-range draft blocks the save.
 */
function LevelEditor({
  memberId,
  level,
  messages,
}: {
  memberId: string;
  level: number | null;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<number>(level ?? 1);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    draft === null ||
    (/^\d{1,2}$/.test(draft) && Number(draft) >= 1 && Number(draft) <= MAX_LEVEL);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await setMemberInvitationLevel(memberId, current);
    setBusy(false);
    if (!result.ok) {
      setError(t("We couldn't save the level.", messages));
      return;
    }
    setDraft(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="member-invitation-level" className="text-xs font-semibold">
          {t("Level", messages)}
        </label>
        <input
          id="member-invitation-level"
          type="number"
          min={1}
          max={MAX_LEVEL}
          step={1}
          value={draft ?? String(current)}
          disabled={busy}
          aria-label={t("Level", messages)}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              setDraft("");
              return;
            }
            if (!/^\d{1,2}$/.test(raw)) return;
            const next = Number(raw);
            if (next >= 1 && next <= MAX_LEVEL) setCurrent(next);
            setDraft(raw);
          }}
          onBlur={() => {
            if (draft === null) return;
            if (!valid) {
              setDraft(null);
              return;
            }
            setDraft(String(current));
          }}
          className={`${inputClass} w-20`}
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !valid}
          className={buttonClass}
        >
          {busy ? t("Saving…", messages) : level === null ? t("Assign level", messages) : t("Save", messages)}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

/** A member's quota block: the live numbers, the warnings and the level field. */
function MemberQuota({
  member,
  quota,
  messages,
}: {
  member: { id: string; invitation_level: number | null };
  quota: InvitationQuota;
  messages: TranslationMap;
}) {
  return (
    <div className="flex flex-col gap-2">
      <QuotaLines level={member.invitation_level} quota={quota} messages={messages} />
      <LevelEditor memberId={member.id} level={member.invitation_level} messages={messages} />
    </div>
  );
}

function GrantRow({
  grant,
  saving,
  onRevoke,
  locale,
  timeZone,
  messages,
}: {
  grant: InvitationGrant;
  saving: boolean;
  onRevoke: (grantId: string) => void;
  locale: Locale;
  timeZone: string;
  messages: TranslationMap;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0">
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
          onClick={() => onRevoke(grant.id)}
          className={buttonClass}
        >
          {t("Revoke", messages)}
        </button>
      )}
    </li>
  );
}

/** The grants list and its revoke action, with its own in-flight state. */
function GrantsList({
  memberId,
  grants,
  locale,
  timeZone,
  messages,
}: {
  memberId: string;
  grants: InvitationGrant[];
  locale: Locale;
  timeZone: string;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke(grantId: string) {
    setSaving(true);
    setError(null);
    const result = await revokeInvitationGrant(memberId, grantId);
    setSaving(false);
    if (!result.ok) {
      setError(t("We couldn't revoke that grant.", messages));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted-foreground">{t("Grants", messages)}</h3>
      {grants.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("No grants yet.", messages)}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {grants.map((grant) => (
            <GrantRow
              key={grant.id}
              grant={grant}
              saving={saving}
              onRevoke={() => void revoke(grant.id)}
              locale={locale}
              timeZone={timeZone}
              messages={messages}
            />
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
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
  const isAdmin = member.role === "admin" || member.role === "super_admin";
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
        <MemberQuota member={member} quota={quota} messages={messages} />
      )}

      <GrantsList
        memberId={member.id}
        grants={grants}
        locale={locale}
        timeZone={timeZone}
        messages={messages}
      />
    </section>
  );
}
