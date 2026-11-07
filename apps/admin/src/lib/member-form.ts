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
 * consequence, never a bare "Are you sure?".
 */
export function deactivationCopy(
  name: string,
  messages: TranslationMap,
): { trigger: string; title: string; consequence: string; note: string; confirm: string } {
  return {
    trigger: t("Deactivate member", messages),
    title: t("Deactivate {name}?", messages, { name }),
    consequence: t("{name} will lose access immediately.", messages, { name }),
    note: t("This cannot be undone from this page.", messages),
    confirm: t("Deactivate", messages),
  };
}
