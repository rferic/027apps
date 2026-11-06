import { cache } from "react";
import { redirect } from "next/navigation";
import { getInfra } from "@/lib/api/door";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Roles that may open the panel at all; `user` is a valid profile role, never a panel role. */
export type PanelRole = "admin" | "super_admin";

export interface PanelUser {
  id: string;
  email: string;
  displayName: string;
  role: "super_admin" | "admin" | "user";
}

const ROLE_RANK: Record<PanelUser["role"], number> = {
  user: 0,
  admin: 1,
  super_admin: 2,
};

/**
 * Server-side panel identity: the session comes from Supabase auth, the role
 * and display name from `profiles` (RLS-bypassing read through the service
 * pool, the same source the API door uses). A deactivated profile has no row
 * for this query, so it is treated as signed out. `cache()` makes the layout
 * and the page share one read per request.
 */
export const loadPanelUser = cache(async (): Promise<PanelUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { settingsDeps } = await getInfra();
  const { rows } = await settingsDeps.db.query(
    "select display_name, role from public.profiles where id = $1 and deactivated_at is null",
    [data.user.id],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    displayName: String(row.display_name ?? ""),
    role: row.role as PanelUser["role"],
  };
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
  const user = await loadPanelUser();
  if (!user) redirect("/login");

  return hasPanelRole(user, min) ? { user } : { denied: true, user };
}
