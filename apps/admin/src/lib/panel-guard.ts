import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getInfra } from "@/lib/api/door";
import { isSupportedLocale } from "@/lib/locale";
import { isTheme, type Theme } from "@/lib/theme";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Locale } from "@027apps/i18n/types.js";

/** Roles that may open the panel at all; `user` is a valid profile role, never a panel role. */
export type PanelRole = "admin" | "super_admin";

export interface PanelUser {
  id: string;
  email: string;
  displayName: string;
  role: "super_admin" | "admin" | "user";
  /** Per-user preferences; the database wins over the cookie. */
  locale: Locale;
  theme: Theme;
}

const ROLE_RANK: Record<PanelUser["role"], number> = {
  user: 0,
  admin: 1,
  super_admin: 2,
};

/** What the panel guard knows before deciding: no session, session without a usable profile, or a profile. */
export type PanelIdentity =
  | { kind: "anonymous" }
  | { kind: "unusable" }
  | { kind: "user"; user: PanelUser };

/**
 * Server-side panel identity: the session comes from Supabase auth, the role
 * and display name from `profiles` (RLS-bypassing read through the service
 * pool, the same source the API door uses). A session whose profile is
 * deactivated or missing is `unusable`, not anonymous: the guard must clear it
 * instead of bouncing between /panel and /login. `cache()` makes the layout and
 * the page share one read per request.
 */
export const loadPanelIdentity = cache(async (): Promise<PanelIdentity> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { kind: "anonymous" };

  const { settingsDeps } = await getInfra();
  const { rows } = await settingsDeps.db.query(
    `select display_name, role, locale, theme
       from public.profiles where id = $1 and deactivated_at is null`,
    [data.user.id],
  );
  const row = rows[0];
  if (!row) return { kind: "unusable" };

  return {
    kind: "user",
    user: {
      id: data.user.id,
      email: data.user.email ?? "",
      displayName: String(row.display_name ?? ""),
      role: row.role as PanelUser["role"],
      locale:
        typeof row.locale === "string" && isSupportedLocale(row.locale) ? row.locale : "en",
      theme: typeof row.theme === "string" && isTheme(row.theme) ? row.theme : "system",
    },
  };
});

/** The profile for callers that only need a user (setup wizard). */
export const loadPanelUser = cache(async (): Promise<PanelUser | null> => {
  const identity = await loadPanelIdentity();
  return identity.kind === "user" ? identity.user : null;
});

/** Whether `user` reaches at least `min` (super_admin ≥ admin ≥ user). */
export function hasPanelRole(user: PanelUser, min: PanelRole): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[min];
}

/**
 * Page guard: no session or a deactivated profile goes to the login screen;
 * an authenticated role below the page minimum is reported as `denied` so the
 * caller renders a generic 403 without enumerating routes or roles. The denial
 * still carries the user so the 403 can greet them and let them sign out.
 */
export async function requirePanel(
  min: PanelRole,
): Promise<{ user: PanelUser } | { denied: true; user: PanelUser }> {
  // The guard exists to resolve the request's session. Wait for a real request
  // before touching the Supabase client: `GoTrueClient` reads `Date.now()` when
  // it loads the session, and Cache Components forbids that while prerendering
  // a static shell.
  await connection();
  const identity = await loadPanelIdentity();
  if (identity.kind === "anonymous") redirect("/login");
  // A session without an active profile is not a login problem: clear the
  // cookies before returning to /login, or /login would bounce to /panel.
  if (identity.kind === "unusable") redirect("/logout?reason=access_revoked");

  const user = identity.user;
  return hasPanelRole(user, min) ? { user } : { denied: true, user };
}
