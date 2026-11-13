import { withDoor } from "@027apps/core/api/door.js";
import { DomainError } from "@027apps/core/errors.js";
import { getInfra } from "@/lib/api/door";
import { latestAndroidRelease } from "@/lib/android-release";

/**
 * GET /api/v1/app/android — what the app checks to know whether a newer build
 * exists. Public: the updater runs before the user is signed in on a fresh
 * install. `apk_url` is relative so a self-hosted instance never sends the app
 * to GitHub.
 */
export async function GET(req: Request) {
  const { deps, auth } = await getInfra();
  return withDoor(
    req,
    {
      scopes: [],
      auth,
      rateLimit: { identity: "ip", limit: 30 },
    },
    deps,
    async () => {
      const release = await latestAndroidRelease();
      if (!release) throw new DomainError("not_found", "No Android release published yet");
      return {
        version_code: release.versionCode,
        version_name: release.versionName,
        tag: release.tag,
        apk_url: "/download/android",
      };
    },
  );
}
