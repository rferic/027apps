import { DomainError } from "../errors";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";

/**
 * Devices (core-data-model §3.6): push registration and panel revocation.
 * `push_token` is unique so a phone that changes user is reassigned, never
 * duplicated. Revoking a device is soft and also drops the user's Auth
 * sessions when the adapter supports it; the access JWT still lives at most
 * its configured 15 minutes.
 */
export interface DevicesDeps {
  db: QueryClient;
  revokeSessions?: (userId: string) => Promise<void>;
  /** Used when a write touches more than one row (notification preferences). */
  withTransaction?: <T>(fn: (db: QueryClient) => Promise<T>) => Promise<T>;
}

export type DevicePlatform = "android" | "ios";

export type DeviceView = {
  id: string;
  user_id: string;
  platform: DevicePlatform;
  push_token: string | null;
  /** The device master switch; turning it off keeps the device and its session. */
  push_enabled: boolean;
  last_seen_at: string;
  revoked_at: string | null;
  created_at: string;
};

export type RegisterDeviceInput = {
  platform: DevicePlatform;
  push_token?: string | null;
};

export type DeviceFilters = { user_id?: string };

const PLATFORMS: readonly DevicePlatform[] = ["android", "ios"];
const toIso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? "");
const toIsoOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : toIso(value);

const VIEW_COLUMNS =
  "id, user_id, platform, push_token, push_enabled, last_seen_at, revoked_at, created_at";

function toView(row: Record<string, unknown>): DeviceView {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    platform: String(row.platform) as DevicePlatform,
    push_token: row.push_token === null ? null : String(row.push_token),
    push_enabled: row.push_enabled !== false,
    last_seen_at: toIso(row.last_seen_at),
    revoked_at: toIsoOrNull(row.revoked_at),
    created_at: toIso(row.created_at),
  };
}

function isAdmin(caller: Caller): boolean {
  if (caller.kind === "session") return caller.role === "admin" || caller.role === "super_admin";
  if (caller.kind === "service") return true;
  // A delegated key is always a plain user, whatever its stored role cap.
  return false;
}

/** The user a device belongs to; service keys have no devices. */
function actorUserId(caller: Caller): string {
  if (caller.kind === "session" || caller.kind === "delegated") return caller.userId;
  throw new DomainError("insufficient_scope");
}

export async function registerDevice(
  deps: DevicesDeps,
  caller: Caller,
  input: RegisterDeviceInput,
): Promise<DeviceView> {
  const userId = actorUserId(caller);
  if (!PLATFORMS.includes(input.platform)) {
    throw new DomainError("validation_failed", "unsupported platform");
  }
  const pushToken = input.push_token?.trim() || null;

  const { rows } = pushToken
    ? await deps.db.query(
        `insert into public.devices (user_id, platform, push_token, last_seen_at)
         values ($1, $2, $3, now())
         on conflict (push_token) do update
           set user_id = excluded.user_id,
               platform = excluded.platform,
               last_seen_at = now(),
               revoked_at = null
         returning ${VIEW_COLUMNS}`,
        [userId, input.platform, pushToken],
      )
    : await deps.db.query(
        `insert into public.devices (user_id, platform, last_seen_at)
         values ($1, $2, now())
         returning ${VIEW_COLUMNS}`,
        [userId, input.platform],
      );
  return toView(rows[0]!);
}

export async function listDevices(
  deps: DevicesDeps,
  caller: Caller,
  filters: DeviceFilters = {},
): Promise<DeviceView[]> {
  const actor = actorUserId(caller);
  const target = filters.user_id ?? actor;
  if (target !== actor && !isAdmin(caller)) {
    // Deliberately indistinguishable from an empty/absent resource.
    throw new DomainError("insufficient_scope");
  }

  const { rows } = await deps.db.query(
    `select ${VIEW_COLUMNS} from public.devices
      where user_id = $1 order by last_seen_at desc, id desc`,
    [target],
  );
  return rows.map(toView);
}

export interface RevokeDeviceOptions {
  /**
   * `false` is the owner's own logout: unregister the push device but keep the
   * other sessions (web and other phones) alive. Admins revoking someone
   * else's device always revoke all sessions, even if they pass `false`.
   */
  revokeSessions?: boolean;
}

export async function revokeDevice(
  deps: DevicesDeps,
  caller: Caller,
  id: string,
  options: RevokeDeviceOptions = {},
): Promise<void> {
  const { rows } = await deps.db.query(
    `select ${VIEW_COLUMNS} from public.devices where id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new DomainError("not_found");
  const owner = String(row.user_id);
  const callerUserId =
    caller.kind === "session" || caller.kind === "delegated" ? caller.userId : null;
  const ownerRevokes = callerUserId === owner;
  if (caller.kind === "service" || (!isAdmin(caller) && !ownerRevokes)) {
    throw new DomainError("not_found");
  }

  if (row.revoked_at === null || row.revoked_at === undefined) {
    await deps.db.query(
      "update public.devices set revoked_at = now() where id = $1 and revoked_at is null",
      [id],
    );
  }

  // Best effort: the soft revoke already stands; the access JWT is bounded by
  // its 15-minute lifetime even if the session cleanup fails. The owner's
  // `local` logout never deletes the other devices' sessions.
  const revokeAll = !ownerRevokes || options.revokeSessions !== false;
  if (revokeAll && deps.revokeSessions) {
    await deps.revokeSessions(owner).catch(() => undefined);
  }
}

/**
 * Revokes every other push device of the caller, keeping the one the new phone
 * just registered. It does **not** touch `auth.sessions`: the client signs the
 * old phone out with `signOut({ scope: "OTHERS" })`, so the server cannot
 * accidentally revoke the session it just created.
 */
export async function revokeOtherDevices(
  deps: DevicesDeps,
  caller: Caller,
  keepDeviceId: string | null,
): Promise<{ revoked: number }> {
  const userId = actorUserId(caller);
  if (keepDeviceId === null) {
    // The new phone has no push device to keep (no Play Services or FCM off):
    // the old phone still has to stop receiving notifications.
    const { rows } = await deps.db.query(
      `update public.devices set revoked_at = now()
        where user_id = $1 and revoked_at is null
        returning id`,
      [userId],
    );
    return { revoked: rows.length };
  }

  const { rows: keep } = await deps.db.query(
    "select id from public.devices where id = $1 and user_id = $2",
    [keepDeviceId, userId],
  );
  if (!keep[0]) throw new DomainError("not_found");

  const { rows } = await deps.db.query(
    `update public.devices set revoked_at = now()
      where user_id = $1 and id <> $2 and revoked_at is null
      returning id`,
    [userId, keepDeviceId],
  );
  return { revoked: rows.length };
}
