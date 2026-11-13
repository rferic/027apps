import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAndroidReleaseCache } from "@/lib/android-release";
import { GET } from "./route";

const RELEASES = [
  {
    tag_name: "v0.2.0",
    draft: true,
    assets: [{ name: "app-release.apk", browser_download_url: "https://example.test/draft.apk" }],
  },
  {
    tag_name: "dev-0.1.0",
    draft: false,
    assets: [
      { name: "notes.txt", browser_download_url: "https://example.test/notes.txt" },
      { name: "app-debug.apk", browser_download_url: "https://example.test/app-debug.apk" },
    ],
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function bytes(size = 4): Response {
  return new Response(new Uint8Array(size), {
    status: 200,
    headers: { "content-length": String(size) },
  });
}

beforeEach(() => resetAndroidReleaseCache());
afterEach(() => vi.unstubAllGlobals());

describe("GET /download/android", () => {
  it("streams the latest APK from the release without leaving the instance", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("api.github.com") ? jsonResponse(RELEASES) : bytes(1024),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.android.package-archive");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="027apps-dev-0.1.0.apk"');
    expect(res.headers.get("content-length")).toBe("1024");
    expect((await res.arrayBuffer()).byteLength).toBe(1024);
    // The draft and the non-apk asset are ignored.
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/app-debug.apk",
      expect.objectContaining({ redirect: "follow" }),
    );
  });

  it("answers 404 when no release carries an APK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([{ tag_name: "v0.1.0", assets: [] }])),
    );
    expect((await GET()).status).toBe(404);
  });

  it("answers 503 when GitHub cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));
    expect((await GET()).status).toBe(503);
  });
});
