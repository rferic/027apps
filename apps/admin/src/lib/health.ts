import { NextResponse } from "next/server";

/**
 * Health check for the keep-alive and the platform probes.
 *
 * The old route called `auth.admin.listUsers`, an admin API that costs a full
 * round trip and says nothing about the database. A trivial `select 1` through
 * the pooled connection is cheaper and truthful: if Postgres is paused or
 * unreachable, the instance is degraded.
 */
export interface DatabaseClientPort {
  query(sql: string): Promise<unknown>;
  release(): void;
}

export interface DatabasePort {
  connect(): Promise<DatabaseClientPort>;
}

const DEFAULT_TIMEOUT_MS = 2_000;

/** Rejects when `promise` does not settle in time; the source stays handled. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // A losing promise must not surface as an unhandled rejection.
  promise.catch(() => undefined);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** True when the database answers a trivial query in time. */
export async function probeDatabase(
  port: DatabasePort,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  let client: DatabaseClientPort | null = null;
  try {
    client = await withTimeout(port.connect(), timeoutMs);
    await withTimeout(client.query("select 1"), timeoutMs);
    return true;
  } catch {
    return false;
  } finally {
    client?.release();
  }
}

/** The only public contract of the route: ok/degraded, never cached. */
export function healthResponse(healthy: boolean): NextResponse {
  const response = NextResponse.json(
    { status: healthy ? "ok" : "degraded" },
    { status: healthy ? 200 : 503 },
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
