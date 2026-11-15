import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import type { MemberRole, MemberRow } from "@/lib/panel-members";

export type ViewerRole = "super_admin" | "admin" | "user";

export interface ProfileValues {
  display_name: string;
  locale: string;
  timezone: string;
  role: MemberRole;
}

export interface MemberPatch {
  display_name?: string;
  locale?: string;
  timezone?: string;
  theme?: "system" | "light" | "dark";
  role?: MemberRole;
}

/** Admins manage admins/users but never touch a super_admin role. */
export function roleOptions(viewerRole: ViewerRole): MemberRole[] {
  return viewerRole === "super_admin"
    ? ["super_admin", "admin", "user"]
    : ["admin", "user"];
}

export function canAssignRole(viewerRole: ViewerRole, currentRole: MemberRole): boolean {
  return viewerRole === "super_admin" || currentRole !== "super_admin";
}

/**
 * The API only accepts the profile fields plus `role`. Role is sent only when
 * it actually changes, so an admin editing a super_admin profile never posts a
 * role the service would reject.
 */
export function buildProfilePatch(
  member: Pick<MemberRow, "role">,
  values: ProfileValues,
): MemberPatch {
  const patch: MemberPatch = {
    display_name: values.display_name,
    locale: values.locale,
    timezone: values.timezone,
  };
  if (values.role !== member.role) patch.role = values.role;
  return patch;
}

/**
 * Destructive confirmation copy (§6): it must name the member and the
 * consequence, never a bare "Are you sure?". Deactivation is soft, so the
 * copy says it is reversible and points at the restore action.
 */
export function deactivationCopy(
  name: string,
  messages: TranslationMap,
): { trigger: string; title: string; consequence: string; note: string; confirm: string } {
  return {
    trigger: t("Deactivate member", messages),
    title: t("Deactivate {name}?", messages, { name }),
    consequence: t("{name} will lose access immediately.", messages, { name }),
    note: t("You can reactivate this member later from this page.", messages),
    confirm: t("Deactivate", messages),
  };
}

/** Brief confirmation for the reversible action: restore access. */
export function restoreCopy(
  name: string,
  messages: TranslationMap,
): { trigger: string; title: string; consequence: string; confirm: string } {
  return {
    trigger: t("Reactivate member", messages),
    title: t("Reactivate {name}?", messages, { name }),
    consequence: t("{name} will be able to sign in again.", messages, { name }),
    confirm: t("Reactivate", messages),
  };
}

/**
 * Physical deletion copy: it names the member, states that nothing can be
 * undone and that the audit history goes with the profile. Typing the name is
 * the second barrier, not just a click.
 */
export function purgeCopy(
  name: string,
  messages: TranslationMap,
): {
  trigger: string;
  title: string;
  consequence: string;
  note: string;
  prompt: string;
  confirm: string;
} {
  return {
    trigger: t("Delete permanently", messages),
    title: t("Delete {name} permanently?", messages, { name }),
    consequence: t("{name} and their audit history will be deleted for good.", messages, { name }),
    note: t("This cannot be undone.", messages),
    prompt: t("Type {name} to confirm", messages, { name }),
    confirm: t("Delete permanently", messages),
  };
}

/** The typed name must match exactly (outer whitespace is ignored). */
export function canConfirmPurge(typed: string, name: string): boolean {
  return typed.trim() === name;
}

/** Where the page lands after a successful purge: the list no longer has it. */
export const PURGE_REDIRECT = "/panel/members";
