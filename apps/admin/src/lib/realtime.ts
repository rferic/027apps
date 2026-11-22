import type { RealtimePort, PushPort } from "@027apps/core/realtime/service.js";
import { createFcmPush } from "@027apps/core/push/fcm.js";

/** Supabase Broadcast over the private REST endpoint with the service key. */
export function createBroadcastPort(url: string, serviceRoleKey: string): RealtimePort {
  return {
    async publish(topic, message) {
      const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ topic, event: message.type, payload: message, private: true }],
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error("realtime broadcast failed");
    },
  };
}

type Db = {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

/**
 * Why the push sender could not be built, or `ok`. The panel shows this as a
 * degraded health reason: a configured integration that silently cannot send is
 * worse than one that is not configured at all.
 */
export type PushHealth = "ok" | "not_configured" | "unreadable" | "invalid";

export async function diagnosePush(
  db: Db,
  encryption: { decrypt(value: string, slot: string): Promise<string | null> } | null,
): Promise<PushHealth> {
  const key = "notifications.push.fcm_service_account";
  const { rows } = await db.query(
    "select value_encrypted, (select value from public.settings where key = 'notifications.push.provider') as provider from public.settings where key = $1",
    [key],
  );
  const provider = rows[0]?.provider;
  const encrypted = rows[0]?.value_encrypted;
  if (!encrypted) return "not_configured";
  if (provider !== "fcm") return "not_configured";
  if (!encryption) return "unreadable";
  const json = await encryption.decrypt(String(encrypted), key);
  if (!json) return "unreadable";
  return createFcmPush(json) ? "ok" : "invalid";
}

/** Builds the FCM port from the encrypted service-account setting (optional). */
export async function createPushFromSettings(
  db: Db,
  encryption: { decrypt(value: string, slot: string): Promise<string | null> } | null,
): Promise<PushPort | undefined> {
  const key = "notifications.push.fcm_service_account";
  const { rows } = await db.query("select value_encrypted from public.settings where key = $1", [key]);
  const encrypted = rows[0]?.value_encrypted;
  if (!encrypted || !encryption) return undefined;
  const json = await encryption.decrypt(String(encrypted), key);
  if (!json) return undefined;
  return createFcmPush(json) ?? undefined;
}

export interface OutboxDeps {
  db: Db;
  realtime?: RealtimePort;
  push?: PushPort;
}

/**
 * Everything `publishPending` needs, from one place: the write hook and the
 * maintenance job both publish the same outbox, so both must carry push. Wiring
 * push in only one of them silently delivers realtime without notifications.
 */
export async function outboxDepsFromSettings(input: {
  db: Db;
  encryption: { decrypt(value: string, slot: string): Promise<string | null> } | null;
  url?: string;
  serviceKey?: string;
}): Promise<OutboxDeps> {
  const push = await createPushFromSettings(input.db, input.encryption);
  return {
    db: input.db,
    ...(input.url && input.serviceKey ? { realtime: createBroadcastPort(input.url, input.serviceKey) } : {}),
    ...(push ? { push } : {}),
  };
}
