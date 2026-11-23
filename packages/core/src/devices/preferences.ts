import { DomainError } from "../errors";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";
import { NOTIFICATION_TYPES, isNotificationKind } from "../notifications/catalog";
import type { DevicesDeps } from "./service";

/**
 * Notification preferences of one device (sprint 17, task 02). The master switch
 * lives on the device row and the muted kinds are rows, so the default is
 * everything on. Only the owner reads or writes them: a foreign device and a
 * missing one answer the same `not_found`.
 */
export type NotificationPreferenceTypeView = {
  key: string;
  enabled: boolean;
};

export type NotificationPreferenceGroupView = {
  module: { key: string; name: string } | null;
  types: NotificationPreferenceTypeView[];
};

export type NotificationPreferencesView = {
  device: { id: string; push_enabled: boolean };
  groups: NotificationPreferenceGroupView[];
};

export type NotificationPreferencesInput = {
  push_enabled: boolean;
  muted: string[];
};

function actorUserId(caller: Caller): string {
  if (caller.kind === "session" || caller.kind === "delegated") return caller.userId;
  throw new DomainError("insufficient_scope");
}

/** The device, when it belongs to the caller; anything else is `not_found`. */
async function ownedDevice(
  deps: DevicesDeps,
  caller: Caller,
  deviceId: string,
): Promise<{ push_enabled: boolean }> {
  const { rows } = await deps.db.query(
    "select user_id, push_enabled from public.devices where id = $1",
    [deviceId],
  );
  const row = rows[0];
  if (!row || String(row.user_id) !== actorUserId(caller)) {
    throw new DomainError("not_found");
  }
  return { push_enabled: row.push_enabled !== false };
}

async function mutedKinds(db: QueryClient, deviceId: string): Promise<Set<string>> {
  const { rows } = await db.query(
    "select kind from public.device_notification_mutes where device_id = $1",
    [deviceId],
  );
  return new Set(rows.map((row) => String(row.kind)));
}

async function activeModuleNames(
  db: QueryClient,
  keys: string[],
): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  const { rows } = await db.query(
    `select key, name from public.module_registry
      where state = 'active' and key = any($1::text[])`,
    [keys],
  );
  return new Map(rows.map((row) => [String(row.key), String(row.name)]));
}

function buildView(
  deviceId: string,
  pushEnabled: boolean,
  muted: Set<string>,
  names: Map<string, string>,
): NotificationPreferencesView {
  const byModule = new Map<string | null, NotificationPreferenceTypeView[]>();
  for (const type of NOTIFICATION_TYPES) {
    // A module that is not installed has no switch: its pushes cannot arrive.
    if (type.module !== null && !names.has(type.module)) continue;
    const list = byModule.get(type.module) ?? [];
    list.push({ key: type.key, enabled: !muted.has(type.key) });
    byModule.set(type.module, list);
  }
  const modules = [...byModule.entries()]
    .filter(([module]) => module !== null)
    .map(([module, types]) => ({
      module: { key: module as string, name: names.get(module as string) ?? (module as string) },
      types,
    }));
  return {
    device: { id: deviceId, push_enabled: pushEnabled },
    // The Core's own notifications always come first as the general group.
    groups: [{ module: null, types: byModule.get(null) ?? [] }, ...modules],
  };
}

export async function readNotificationPreferences(
  deps: DevicesDeps,
  caller: Caller,
  deviceId: string,
): Promise<NotificationPreferencesView> {
  const device = await ownedDevice(deps, caller, deviceId);
  const muted = await mutedKinds(deps.db, deviceId);
  const modules = [...new Set(NOTIFICATION_TYPES.map((type) => type.module).filter(Boolean))] as string[];
  const names = await activeModuleNames(deps.db, modules);
  return buildView(deviceId, device.push_enabled, muted, names);
}

export async function writeNotificationPreferences(
  deps: DevicesDeps,
  caller: Caller,
  deviceId: string,
  input: NotificationPreferencesInput,
): Promise<NotificationPreferencesView> {
  const unique = new Set(input.muted);
  if (unique.size !== input.muted.length || input.muted.some((kind) => !isNotificationKind(kind))) {
    throw new DomainError("validation_failed", "unknown or repeated notification kind");
  }
  await ownedDevice(deps, caller, deviceId);

  const run =
    deps.withTransaction ?? (<T>(fn: (db: QueryClient) => Promise<T>) => fn(deps.db));
  await run(async (db) => {
    await db.query("update public.devices set push_enabled = $2 where id = $1", [
      deviceId,
      input.push_enabled,
    ]);
    await db.query("delete from public.device_notification_mutes where device_id = $1", [
      deviceId,
    ]);
    if (input.muted.length > 0) {
      await db.query(
        `insert into public.device_notification_mutes (device_id, kind)
         select $1, unnest($2::text[])`,
        [deviceId, input.muted],
      );
    }
  });

  const modules = [...new Set(NOTIFICATION_TYPES.map((type) => type.module).filter(Boolean))] as string[];
  const names = await activeModuleNames(deps.db, modules);
  return buildView(deviceId, input.push_enabled, new Set(input.muted), names);
}
