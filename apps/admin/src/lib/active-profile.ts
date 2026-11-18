import { getInfra } from "@/lib/api/door";

/**
 * `true` when the Auth user still has an active profile.
 *
 * A recovery link is minted before an administrator may deactivate the account
 * and stays valid for an hour; verifying it creates a fresh session. Checking
 * the profile before keeping that session is what makes "deactivated" mean
 * revoked on every path, not only inside the panel.
 */
export async function isActiveProfile(userId: string): Promise<boolean> {
  const { settingsDeps } = await getInfra();
  const { rows } = await settingsDeps.db.query(
    "select 1 from public.profiles where id = $1 and deactivated_at is null",
    [userId],
  );
  return rows.length > 0;
}
