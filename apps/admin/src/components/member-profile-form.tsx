"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES } from "@027apps/core/settings/catalog.js";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { LOCALE_LABELS } from "@/lib/locale";
import { FormActions, FormAlert, FormField } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import {
  buildProfilePatch,
  canAssignRole,
  roleOptions,
  type ViewerRole,
} from "@/lib/member-form";
import type { MutationResult } from "@/lib/member-mutations";
import { patchMember } from "@/lib/member-mutations";
import { panelErrorCodeLabel } from "@/lib/panel-errors";
import type { MemberRow } from "@/lib/panel-members";

type SaveFailure = Extract<MutationResult, { ok: false }>;

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Links a field to its help text and, when present, to its validation message. */
function fieldAria(
  field: string,
  message: string | undefined,
  helpId?: string,
): { "aria-invalid"?: true; "aria-describedby"?: string } {
  const ids = [helpId, message ? `member-${field}-error` : undefined].filter(
    (id): id is string => Boolean(id),
  );
  return {
    "aria-invalid": message ? true : undefined,
    ...(ids.length > 0 ? { "aria-describedby": ids.join(" ") } : {}),
  };
}

function SaveErrorAlert({
  error,
  messages,
}: {
  error: SaveFailure;
  messages: TranslationMap;
}) {
  return (
    <FormAlert
      message={t("We couldn't save the changes.", messages)}
      code={error.code}
      codeLabel={
        error.code === "conflict"
          ? t("Your role change conflicts with the instance rules.", messages)
          : error.code
            ? panelErrorCodeLabel(error.code, messages)
            : undefined
      }
      requestId={error.requestId}
      messages={messages}
    />
  );
}

function RoleField({
  roleEditable,
  viewerRole,
  currentRole,
  error,
  messages,
}: {
  roleEditable: boolean;
  viewerRole: ViewerRole;
  currentRole: MemberRow["role"];
  error?: string;
  messages: TranslationMap;
}) {
  if (!roleEditable) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("Only a super admin can change this role.", messages)}
      </p>
    );
  }

  return (
    <FormField id="member-role" label={t("Role", messages)} error={error}>
      <Select
        id="member-role"
        name="role"
        defaultValue={currentRole}
        {...fieldAria("role", error)}
      >
        {roleOptions(viewerRole).map((role) => (
          <option key={role} value={role}>
            {role === "super_admin"
              ? t("Super admin", messages)
              : role === "admin"
                ? t("Admin", messages)
                : t("User", messages)}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function ProfileFormFields({
  member,
  viewerRole,
  isSelf,
  roleEditable,
  fieldErrors,
  messages,
}: {
  member: MemberRow;
  viewerRole: ViewerRole;
  isSelf: boolean;
  roleEditable: boolean;
  fieldErrors: Record<string, string[]>;
  messages: TranslationMap;
}) {
  return (
    <>
      <FormField
        id="member-display-name"
        label={t("Display name", messages)}
        hint={t("Add a display name between 1 and 80 characters.", messages)}
        hintId="member-display-name-help"
        error={fieldErrors.display_name?.[0]}
        errorId="member-display_name-error"
      >
        <input
          id="member-display-name"
          name="display_name"
          type="text"
          required
          maxLength={80}
          defaultValue={member.display_name}
          {...fieldAria(
            "display_name",
            fieldErrors.display_name?.[0],
            "member-display-name-help",
          )}
          className={inputClass}
        />
      </FormField>

      <FormField
        id="member-locale"
        label={t("Language", messages)}
        error={fieldErrors.locale?.[0]}
      >
        <Select
          id="member-locale"
          name="locale"
          defaultValue={member.locale}
          {...fieldAria("locale", fieldErrors.locale?.[0])}
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {LOCALE_LABELS[locale]}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        id="member-timezone"
        label={t("Time zone", messages)}
        hint={t("Use an IANA time zone, for example Europe/Madrid.", messages)}
        hintId="member-timezone-help"
        error={fieldErrors.timezone?.[0]}
      >
        <input
          id="member-timezone"
          name="timezone"
          type="text"
          required
          defaultValue={member.timezone}
          {...fieldAria("timezone", fieldErrors.timezone?.[0], "member-timezone-help")}
          autoComplete="off"
          className={inputClass}
        />
      </FormField>

      {!isSelf && (
        <RoleField
          roleEditable={roleEditable}
          viewerRole={viewerRole}
          currentRole={member.role}
          error={fieldErrors.role?.[0]}
          messages={messages}
        />
      )}
    </>
  );
}

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
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
    setFieldErrors({});
    const result = await patchMember(member.id, buildProfilePatch(member, values));
    setSaving(false);

    // The API owns the root/last-super-admin invariants: a rejected role change
    // reverts only the <select>, so the typed profile fields are never lost.
    if (!result.ok) {
      const roleSelect = form.elements.namedItem("role");
      if (roleSelect instanceof HTMLSelectElement) roleSelect.value = member.role;
      setFieldErrors(result.details?.fieldErrors ?? {});
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

      <ProfileFormFields
        member={member}
        viewerRole={viewerRole}
        isSelf={isSelf}
        roleEditable={roleEditable}
        fieldErrors={fieldErrors}
        messages={messages}
      />

      <FormActions>
        {saved && (
          <p role="status" className="mr-auto text-xs font-semibold text-success">
            {t("Changes saved.", messages)}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 items-center rounded-control border border-transparent bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {saving ? t("Saving…", messages) : t("Save changes", messages)}
        </button>
      </FormActions>

      {error && <SaveErrorAlert error={error} messages={messages} />}
    </form>
  );
}
