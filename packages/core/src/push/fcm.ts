import { createSign } from "node:crypto";
import type { PushPort } from "../realtime/service";

/**
 * FCM HTTP v1, data-only (realtime spec §6.3). The server never composes text:
 * it sends `{ key, payload }` and the app localizes. Messages are sent per token
 * in bounded batches; there is no batch endpoint in HTTP v1.
 */
export interface FcmAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const FCM_URL = "https://fcm.googleapis.com/v1/projects";

function base64url(value: Buffer | string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function parseAccount(value: string): FcmAccount | null {
  try {
    const parsed = JSON.parse(value) as Partial<FcmAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      token_uri: parsed.token_uri,
    };
  } catch {
    return null;
  }
}

export function createFcmPush(
  serviceAccountJson: string,
  fetchFn: typeof fetch = fetch,
): PushPort | null {
  const account = parseAccount(serviceAccountJson);
  if (!account) return null;

  let cached: { token: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(
      JSON.stringify({
        iss: account!.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: account!.token_uri ?? TOKEN_URI,
        iat: now,
        exp: now + 3600,
      }),
    );
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    signer.end();
    const signature = signer.sign(account!.private_key);
    const assertion = `${header}.${claims}.${base64url(signature)}`;

    const res = await fetchFn(account!.token_uri ?? TOKEN_URI, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error("FCM token exchange failed");
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error("FCM token exchange returned no token");
    cached = {
      token: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    return cached.token;
  }

  async function sendOne(
    token: string,
    data: Record<string, string>,
  ): Promise<{ token: string; error?: "UNREGISTERED" | "INVALID_ARGUMENT" | "RETRY" }> {
    const auth = await accessToken();
    const res = await fetchFn(`${FCM_URL}/${account!.project_id}/messages:send`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: { token, data } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { token };
    const body = (await res.json().catch(() => ({}))) as {
      error?: { status?: string; details?: { errorCode?: string }[] };
    };
    const status = body.error?.status ?? "";
    const detail = body.error?.details?.[0]?.errorCode ?? "";
    if (status === "NOT_FOUND" || detail === "UNREGISTERED") return { token, error: "UNREGISTERED" };
    if (status === "INVALID_ARGUMENT") return { token, error: "INVALID_ARGUMENT" };
    return { token, error: "RETRY" };
  }

  return {
    async send(tokens, data) {
      const results: { token: string; error?: "UNREGISTERED" | "INVALID_ARGUMENT" | "RETRY" }[] = [];
      for (let offset = 0; offset < tokens.length; offset += 500) {
        const batch = tokens.slice(offset, offset + 500);
        results.push(...(await Promise.all(batch.map((token) => sendOne(token, data)))));
      }
      return results;
    },
  };
}
