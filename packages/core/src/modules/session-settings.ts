import type { QueryClient } from "../api/rate-limit-storage";

/**
 * Restores the settings a module call changes. `set local` outlives a released
 * savepoint, so a caller that shares the transaction would keep resolving module
 * tables after a widget or a job ran. An aborted transaction already rolled the
 * settings back, so a failed reset is harmless and must never mask the real error.
 */
export async function resetSessionSettings(db: QueryClient): Promise<void> {
  for (const statement of ["reset statement_timeout", "reset search_path"]) {
    try {
      await db.query(statement);
    } catch {
      // The transaction is already aborted: there is nothing to restore.
    }
  }
}
