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
