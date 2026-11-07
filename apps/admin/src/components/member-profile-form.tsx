"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES } from "@027apps/core/settings/catalog.js";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { LOCALE_LABELS } from "@/lib/locale";
import {
  buildProfilePatch,
  canAssignRole,
  roleOptions,
  type ViewerRole,
} from "@/lib/member-form";
import type { MutationResult } from "@/lib/member-mutations";
import { patchMember } from "@/lib/member-mutations";
import { memberErrorCodeLabel } from "@/lib/member-errors";
import type { MemberRow } from "@/lib/panel-members";

type SaveFailure = Extract<MutationResult, { ok: false }>;

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface MemberProfileFormProps {
  member: MemberRow;
  viewerRole: ViewerRole;
  /** The viewer is editing their own profile: the role stays read-only. */
  isSelf: boolean;
  messages: TranslationMap;
}

/** Profile + role edit; one PATCH with only the fields the API understands. */
export function MemberProfileForm({
  member,
  viewerRole,
  isSelf,
  messages,
}: MemberProfileFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<SaveFailure | null>(null);
  // The API also rejects a self role change; hiding the control keeps the
  // panel from offering an action the Core refuses by design.
  const roleEditable = !isSelf && canAssignRole(viewerRole, member.role);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      display_name: String(data.get("display_name") ?? "").trim(),
      locale: String(data.get("locale") ?? member.locale),
      timezone: String(data.get("timezone") ?? member.timezone).trim(),
      role: roleEditable ? (String(data.get("role")) as MemberRow["role"]) : member.role,
    };

    setSaving(true);
    setSaved(false);
    setError(null);
    const result = await patchMember(member.id, buildProfilePatch(member, values));
    setSaving(false);

    // The API owns the root/last-super-admin invariants: on rejection the form
    // goes back to the saved values instead of keeping the attempted role.
    if (!result.ok) {
      form.reset();
      setError(result);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <h2 className="text-sm font-semibold">{t("Profile", messages)}</h2>

      {isSelf && (
        <p className="text-xs text-muted-foreground">{t("This is your account.", messages)}</p>
      )}

      <label htmlFor="member-display-name" className="flex flex-col gap-1 text-xs font-semibold">
        {t("Display name", messages)}
        <input
          id="member-display-name"
          name="display_name"
          type="text"
          required
          maxLength={80}
          defaultValue={member.display_name}
          aria-describedby="member-display-name-help"
          className={inputClass}
        />
      </label>
      <p id="member-display-name-help" className="text-xs text-muted-foreground">
        {t("Add a display name between 1 and 80 characters.", messages)}
      </p>

      <label htmlFor="member-locale" className="flex flex-col gap-1 text-xs font-semibold">
        {t("Language", messages)}
        <select
          id="member-locale"
          name="locale"
          defaultValue={member.locale}
          className={inputClass}
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {LOCALE_LABELS[locale]}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor="member-timezone" className="flex flex-col gap-1 text-xs font-semibold">
        {t("Time zone", messages)}
        <input
          id="member-timezone"
          name="timezone"
          type="text"
          required
          defaultValue={member.timezone}
          aria-describedby="member-timezone-help"
          autoComplete="off"
          className={inputClass}
        />
      </label>
      <p id="member-timezone-help" className="text-xs text-muted-foreground">
        {t("Use an IANA time zone, for example Europe/Madrid.", messages)}
      </p>

      {!isSelf &&
        (roleEditable ? (
          <label htmlFor="member-role" className="flex flex-col gap-1 text-xs font-semibold">
            {t("Role", messages)}
            <select id="member-role" name="role" defaultValue={member.role} className={inputClass}>
              {roleOptions(viewerRole).map((role) => (
                <option key={role} value={role}>
                  {role === "super_admin"
                    ? t("Super admin", messages)
                    : role === "admin"
                      ? t("Admin", messages)
                      : t("User", messages)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("Only a super admin can change this role.", messages)}
          </p>
        ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 items-center rounded-control border border-transparent bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {saving ? t("Saving…", messages) : t("Save changes", messages)}
        </button>
        {saved && (
          <p role="status" className="text-xs font-semibold text-success">
            {t("Changes saved.", messages)}
          </p>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-card border border-destructive p-3 text-xs">
          <p className="font-semibold text-destructive">
            {t("We couldn't save the changes.", messages)}
          </p>
          {error.code && (
            <p className="mt-1 text-muted-foreground">
              {memberErrorCodeLabel(error.code, messages)}
            </p>
          )}
          {error.requestId && (
            <p className="mt-1 text-muted-foreground">
              {t("Request ID", messages)}:{" "}
              <code className="select-all font-mono">{error.requestId}</code>
            </p>
          )}
        </div>
      )}
    </form>
  );
}
