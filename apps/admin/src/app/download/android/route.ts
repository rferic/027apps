/**
 * Direct APK download: the landing button points here instead of sending the
 * visitor to GitHub. The file still lives in the GitHub release (signed, or the
 * dev pre-release); this route resolves the latest one, picks its first `.apk`
 * asset and streams it, so the URL never leaves the instance.
 *
 * The lookup is cached for a few minutes: releases change rarely and the
 * unauthenticated GitHub API has a small per-IP budget.
 */

const RELEASES_URL = "https://api.github.com/repos/rferic/027apps/releases?per_page=5";
const CACHE_MS = 5 * 60 * 1000;

interface CachedAsset {
  url: string;
  tag: string;
}

interface ReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

interface Release {
  tag_name?: string;
  draft?: boolean;
  assets?: ReleaseAsset[];
}

let cache: CachedAsset | null = null;
let cachedAt = 0;

/** Tests only: forget the previous lookup. */
export function resetDownloadCache(): void {
  cache = null;
  cachedAt = 0;
}

/**
 * Latest published release that carries an APK. Pre-releases count: while there
 * is no signed build, the `dev-*` pre-release is the only downloadable one.
 */
async function resolveApk(fetcher: typeof fetch): Promise<CachedAsset | null> {
  if (cachedAt !== 0 && Date.now() - cachedAt < CACHE_MS) return cache;
  const response = await fetcher(RELEASES_URL, {
    headers: { accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`github answered ${response.status}`);

  const releases = (await response.json()) as Release[];
  const found = releases
    .filter((release) => release.draft !== true)
    .map((release) => ({
      release,
      asset: release.assets?.find((entry) => entry.name?.endsWith(".apk")),
    }))
    .find((entry) => entry.asset?.browser_download_url);

  cachedAt = Date.now();
  cache = found
    ? { url: found.asset!.browser_download_url!, tag: found.release.tag_name ?? "latest" }
    : null;
  return cache;
}

export async function GET() {
  try {
    const asset = await resolveApk(fetch);
    if (!asset) return new Response("No APK published yet", { status: 404 });

    const download = await fetch(asset.url, { redirect: "follow", cache: "no-store" });
    if (!download.ok || !download.body) {
      return new Response("Upstream download failed", { status: 502 });
    }

    const headers = new Headers({
      "content-type": "application/vnd.android.package-archive",
      "content-disposition": `attachment; filename="027apps-${asset.tag}.apk"`,
      "cache-control": "public, max-age=300",
    });
    const length = download.headers.get("content-length");
    if (length) headers.set("content-length", length);

    return new Response(download.body, { status: 200, headers });
  } catch {
    // A GitHub outage must not show a stack trace on a public download link.
    return new Response("Download unavailable", { status: 503 });
  }
}
