import { createHash, randomBytes } from "node:crypto";
import { DomainError } from "../errors";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";

/**
 * Phone migration (spec §5.2/§6.6). The old phone shows a QR with a one-shot
 * bearer token; the new phone exchanges it for a Supabase magic-link hash and
 * verifies it locally. The token lives 60 seconds, is stored only as SHA-256
 * and carries no email, password, refresh token or push token.
 */
export interface DeviceTransfersDeps {
  db: QueryClient;
  withTransaction?: <T>(fn: (db: QueryClient) => Promise<T>) => Promise<T>;
  auth: DeviceTransfersAuth;
  now?: () => Date;
}

export interface DeviceTransfersAuth {
  /** Email of the profile's Auth user; null when it disappeared. */
  getUserEmail(userId: string): Promise<string | null>;
  /** `generateLink({ type: "magiclink" })`: only the hash leaves Supabase. */
  createMagicLink(email: string): Promise<{ tokenHash: string }>;
}

export type DeviceTransferState = "pending" | "used" | "expired";

export type DeviceTransferStatus = {
  id: string;
  state: DeviceTransferState;
  expires_at: string;
  used_at: string | null;
};

export type CreatedDeviceTransfer = {
  transfer: { id: string; expires_at: string };
  token: string;
  path: string;
};

export type ExchangedDeviceTransfer = {
  transfer_id: string;
  email: string;
  token_hash: string;
  expires_at: string;
};

const TOKEN_PREFIX = "027_mig_";
const TTL_MS = 60_000;
const MAX_TOKEN_LENGTH = 200;

const toIso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? "");
const toIsoOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : toIso(value);

export function hashDeviceTransferToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newDeviceTransferToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** A QR is a user's device credential: service and delegated keys never mint one. */
function sessionUserId(caller: Caller): string {
  if (caller.kind !== "session") throw new DomainError("insufficient_scope");
  return caller.userId;
}

function stateOf(row: Record<string, unknown>, now: Date): DeviceTransferState {
  if (row.used_at !== null && row.used_at !== undefined) return "used";
  return new Date(String(row.expires_at)).getTime() <= now.getTime() ? "expired" : "pending";
}

async function withTx<T>(
  deps: DeviceTransfersDeps,
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

/** Mints a 60-second code for the old phone; the token is returned only once. */
export async function createDeviceTransfer(
  deps: DeviceTransfersDeps,
  caller: Caller,
): Promise<CreatedDeviceTransfer> {
  const userId = sessionUserId(caller);
  const now = deps.now?.() ?? new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);
  const token = newDeviceTransferToken();

  const created = await withTx(deps, async (db) => {
    // Opportunistic cleanup: no cron, and a retried transfer creates a new row.
    await db.query(
      `delete from public.device_transfers
        where user_id = $1
          and (used_at is not null or expires_at < now() - interval '1 day')`,
      [userId],
    );
    const { rows } = await db.query(
      `insert into public.device_transfers (user_id, code_hash, expires_at)
       values ($1, $2, $3)
       returning id`,
      [userId, hashDeviceTransferToken(token), expiresAt.toISOString()],
    );
    return { id: String(rows[0]?.id) };
  });

  return {
    transfer: { id: created.id, expires_at: expiresAt.toISOString() },
    token,
    path: `/migrate/${token}`,
  };
}

/** Old-phone polling. Another user's id is indistinguishable from a missing one. */
export async function getDeviceTransferStatus(
  deps: DeviceTransfersDeps,
  caller: Caller,
  id: string,
): Promise<DeviceTransferStatus> {
  const userId = sessionUserId(caller);
  const now = deps.now?.() ?? new Date();
  const { rows } = await deps.db.query(
    `select id, user_id, expires_at, used_at
       from public.device_transfers where id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row || String(row.user_id) !== userId) throw new DomainError("not_found");
  return {
    id: String(row.id),
    state: stateOf(row, now),
    expires_at: toIso(row.expires_at),
    used_at: toIsoOrNull(row.used_at),
  };
}

/**
 * New-phone exchange: validates the token under a row lock, mints a magic link
 * for the account and marks the code used in the same transaction. A magic-link
 * failure rolls back, so the code stays usable while it lives.
 */
export async function exchangeDeviceTransfer(
  deps: DeviceTransfersDeps,
  rawToken: string,
): Promise<ExchangedDeviceTransfer> {
  if (!rawToken.startsWith(TOKEN_PREFIX) || rawToken.length > MAX_TOKEN_LENGTH) {
    throw new DomainError("not_found");
  }
  const tokenHash = hashDeviceTransferToken(rawToken);
  const now = deps.now?.() ?? new Date();

  return withTx(deps, async (db) => {
    const { rows } = await db.query(
      `select id, user_id, expires_at, used_at
         from public.device_transfers where code_hash = $1 for update`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) throw new DomainError("not_found");
    if (stateOf(row, now) !== "pending") throw new DomainError("not_found");

    const userId = String(row.user_id);
    const { rows: profile } = await db.query(
      "select deactivated_at from public.profiles where id = $1",
      [userId],
    );
    const deactivated = profile[0]?.deactivated_at;
    if (!profile[0] || (deactivated !== null && deactivated !== undefined)) {
      throw new DomainError("not_found");
    }

    const email = await deps.auth.getUserEmail(userId);
    if (!email) throw new DomainError("not_found");
    const { tokenHash: magicTokenHash } = await deps.auth.createMagicLink(email);

    await db.query(
      "update public.device_transfers set used_at = now() where id = $1 and used_at is null",
      [row.id],
    );

    return {
      transfer_id: String(row.id),
      email,
      token_hash: magicTokenHash,
      expires_at: toIso(row.expires_at),
    };
  });
}
