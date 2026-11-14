import { latestAndroidRelease } from "@/lib/android-release";

/**
 * Direct APK download: the landing button points here instead of sending the
 * visitor to GitHub. The file still lives in the GitHub release (signed, or the
 * dev pre-release); this route resolves the latest one and streams it, so the
 * URL never leaves the instance.
 */
export async function GET() {
  try {
    const release = await latestAndroidRelease();
    if (!release) return new Response("No APK published yet", { status: 404 });

    const download = await fetch(release.assetUrl, { redirect: "follow", cache: "no-store" });
    if (!download.ok || !download.body) {
      return new Response("Upstream download failed", { status: 502 });
    }

    const headers = new Headers({
      "content-type": "application/vnd.android.package-archive",
      "content-disposition": `attachment; filename="027apps-${release.tag}.apk"`,
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
