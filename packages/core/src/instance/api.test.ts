import { describe, expect, it } from "vitest";
import type { Caller, DoorDeps } from "../api/types";
import type { RateLimitStorage } from "../api/rate-limit-storage";
import { instanceRoute } from "./api.js";

const storage: RateLimitStorage = { increment: async () => ({ count: 1 }) };

function deps(authConfig?: { supabaseUrl: string; supabaseAnonKey: string } | null) {
  const door: DoorDeps = { rateLimitStorage: storage, logger: () => {} };
  return {
    door,
    auth: async (): Promise<Caller> => ({ kind: "anon" }),
    settings: { db: { query: async () => ({ rows: [] }) }, encryption: null },
    version: "1.2.3",
    ...(authConfig === undefined ? {} : { authConfig }),
  };
}

async function body(
  route: ReturnType<typeof instanceRoute>,
): Promise<Record<string, unknown>> {
  const res = await route(new Request("http://local/api/v1/instance"));
  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, unknown>;
}

describe("GET /api/v1/instance auth block", () => {
  it("publishes the Supabase URL and the anon key for native clients", async () => {
    const payload = await body(
      instanceRoute(
        deps({ supabaseUrl: "https://proj.supabase.co", supabaseAnonKey: "anon-key" }),
      ),
    );
    expect(payload.auth).toEqual({
      supabase_url: "https://proj.supabase.co",
      supabase_anon_key: "anon-key",
    });
  });

  it("answers null when the instance has no configuration", async () => {
    expect((await body(instanceRoute(deps()))).auth).toBeNull();
    expect((await body(instanceRoute(deps(null)))).auth).toBeNull();
  });

  it("keeps the setup state and the public settings intact", async () => {
    const payload = await body(instanceRoute(deps()));
    expect(payload).toMatchObject({
      version: "1.2.3",
      requires_setup: true,
      setup_incomplete: false,
      settings_public: {},
    });
  });
});
