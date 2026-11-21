import { createHash, randomBytes } from "node:crypto";
import type { QueryClient } from "../api/rate-limit-storage";

/**
 * Token, hash and transaction helpers shared by every invitation writer
 * (sprint 18 spec §5.2/§5.4). Tokens are minted once, stored only as SHA-256
 * and returned to the caller exactly once; the advisory-lock transaction keeps
 * the quota check and the insert atomic in production, not only under tests.
 */

/** Dependency surface a transaction runner needs. */
export interface InviteTxDeps {
  db: QueryClient;
  withTransaction?: <T>(fn: (db: QueryClient) => Promise<T>) => Promise<T>;
}

/** 32 bytes of entropy, base64url, after the given prefix (e.g. `027_inv_`). */
export function newInviteToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

/** SHA-256 hex digest: the only form a token is ever stored. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Runs `fn` inside a real transaction when the caller provides a runner, and
 * straight through otherwise (a unit test that injects its own fake client).
 */
export async function withInviteTx<T>(
  deps: InviteTxDeps,
  fn: (db: QueryClient) => Promise<T>,
): Promise<T> {
  if (!deps.withTransaction) return fn(deps.db);
  return deps.withTransaction(async (db) => {
    await db.query("BEGIN");
    try {
      const result = await fn(db);
      await db.query("COMMIT");
      return result;
    } catch (err) {
      await db.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  });
}
