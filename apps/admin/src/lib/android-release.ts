/**
 * The Android release the web offers for download. One lookup feeds both the
 * streaming download (`/download/android`) and the version check the app does
 * (`/api/v1/app/android`), and it is cached because releases change rarely and
 * the unauthenticated GitHub API has a small per-IP budget.
 */

const RELEASES_URL = "https://api.github.com/repos/rferic/027apps/releases?per_page=5";
const CACHE_MS = 5 * 60 * 1000;

export interface AndroidRelease {
  tag: string;
  /** Semver without the `v`/`dev-` prefix, e.g. `0.1.0`. */
  versionName: string;
  /**
   * Same formula the app uses for `versionCode`: major*10000 + minor*100 + patch,
   * so two releases always compare with a plain integer.
   */
  versionCode: number;
  /** GitHub asset URL; the download route streams it from here. */
  assetUrl: string;
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

let cache: AndroidRelease | null = null;
let cachedAt = 0;

/** Tests only: forget the previous lookup. */
export function resetAndroidReleaseCache(): void {
  cache = null;
  cachedAt = 0;
}

/** `dev-0.1.0` and `v1.2.3` both map to a comparable version. */
export function parseVersion(tag: string): { versionName: string; versionCode: number } | null {
  const cleaned = tag.replace(/^dev-/, "").replace(/^v/, "");
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(cleaned);
  if (!match) return null;
  const [major, minor, patch] = match.slice(1).map(Number);
  return { versionName: cleaned, versionCode: major * 10_000 + minor * 100 + patch };
}

/**
 * Latest published release with an APK. Pre-releases count: while there is no
 * signed build, the `dev-*` pre-release is the only downloadable one.
 */
export async function latestAndroidRelease(
  fetcher: typeof fetch = fetch,
): Promise<AndroidRelease | null> {
  if (cachedAt !== 0 && Date.now() - cachedAt < CACHE_MS) return cache;

  const response = await fetcher(RELEASES_URL, {
    headers: { accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`github answered ${response.status}`);

  const releases = (await response.json()) as Release[];
  cachedAt = Date.now();
  cache = null;
  for (const release of releases) {
    if (release.draft === true || !release.tag_name) continue;
    const asset = release.assets?.find((entry) => entry.name?.endsWith(".apk"));
    if (!asset?.browser_download_url) continue;
    const version = parseVersion(release.tag_name);
    if (!version) continue;
    cache = {
      tag: release.tag_name,
      versionName: version.versionName,
      versionCode: version.versionCode,
      assetUrl: asset.browser_download_url,
    };
    break;
  }
  return cache;
}
