import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const original = process.env.ANDROID_APP_SHA256;

afterEach(() => {
  if (original === undefined) delete process.env.ANDROID_APP_SHA256;
  else process.env.ANDROID_APP_SHA256 = original;
});

describe("GET /.well-known/assetlinks.json", () => {
  it("publishes every configured fingerprint for the app package", async () => {
    process.env.ANDROID_APP_SHA256 = "AA:BB:CC, DD:EE:FF";
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    await expect(res.json()).resolves.toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.rferic.zero27apps",
          sha256_cert_fingerprints: ["AA:BB:CC", "DD:EE:FF"],
        },
      },
    ]);
  });

  it("answers an empty list when nothing is configured", async () => {
    delete process.env.ANDROID_APP_SHA256;
    await expect((await GET()).json()).resolves.toEqual([]);
  });
});
