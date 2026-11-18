type Db = {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

/**
 * Drops the user's Supabase refresh sessions. Access JWTs already issued stay
 * valid at most their 15-minute lifetime; the profile check is the immediate
 * enforcement for a deactivated or deleted member.
 */
export function revokeSessions(db: Db) {
  return async (userId: string): Promise<void> => {
    await db.query("delete from auth.sessions where user_id = $1", [userId]);
  };
}
