import { describe, expect, it } from "vitest";
import { outboxDepsFromSettings } from "@/lib/realtime";

const SERVICE_ACCOUNT = JSON.stringify({
  project_id: "demo-project",
  client_email: "push@demo-project.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----\n",
});

function dbWith(rows: Array<Record<string, unknown>>) {
  return {
    async query() {
      return { rows };
    },
  };
}

describe("outboxDepsFromSettings", () => {
  // Regression: the write hook published realtime without push, so a movement
  // reached the app's open screen but never the notification shade.
  it("carries the push port when the service account is configured", async () => {
    const deps = await outboxDepsFromSettings({
      db: dbWith([{ value_encrypted: "v1:iv:tag:cipher" }]),
      encryption: { async decrypt() { return SERVICE_ACCOUNT; } },
      url: "https://example.test",
      serviceKey: "service-key",
    });

    expect(deps.realtime).toBeDefined();
    expect(typeof deps.push?.send).toBe("function");
  });

  it("stays realtime-only when no service account is stored", async () => {
    const deps = await outboxDepsFromSettings({
      db: dbWith([]),
      encryption: { async decrypt() { return SERVICE_ACCOUNT; } },
      url: "https://example.test",
      serviceKey: "service-key",
    });

    expect(deps.realtime).toBeDefined();
    expect(deps.push).toBeUndefined();
  });

  it("stays realtime-only when the master key is unusable", async () => {
    const deps = await outboxDepsFromSettings({
      db: dbWith([{ value_encrypted: "v1:iv:tag:cipher" }]),
      encryption: null,
      url: "https://example.test",
      serviceKey: "service-key",
    });

    expect(deps.push).toBeUndefined();
  });
});
