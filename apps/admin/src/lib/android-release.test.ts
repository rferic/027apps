import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { latestAndroidRelease, parseVersion, resetAndroidReleaseCache } from "./android-release";

beforeEach(() => resetAndroidReleaseCache());
afterEach(() => vi.unstubAllGlobals());

describe("android release", () => {
  it("maps a tag to a comparable version", () => {
    expect(parseVersion("dev-0.1.0")).toEqual({ versionName: "0.1.0", versionCode: 100 });
    expect(parseVersion("v1.2.3")).toEqual({ versionName: "1.2.3", versionCode: 10203 });
    expect(parseVersion("nightly")).toBeNull();
  });

  it("skips drafts and releases without an apk, and caches the answer", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify([
          { tag_name: "v9.9.9", draft: true, assets: [{ name: "a.apk", browser_download_url: "https://x/a.apk" }] },
          { tag_name: "v2.0.0", draft: false, assets: [] },
          { tag_name: "v1.2.0", draft: false, assets: [{ name: "app.apk", browser_download_url: "https://x/app.apk" }] },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const release = await latestAndroidRelease();
    expect(release).toEqual({
      tag: "v1.2.0",
      versionName: "1.2.0",
      versionCode: 10200,
      assetUrl: "https://x/app.apk",
    });
    await latestAndroidRelease();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
