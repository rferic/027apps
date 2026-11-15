/** The Android application id, fixed by the app's build file. */
const PACKAGE_NAME = "com.rferic.zero27apps";

/**
 * App Links verification: Android fetches this file to trust the https invite
 * URLs and open them in the app. Only public certificate fingerprints are
 * published (`ANDROID_APP_SHA256`, comma separated); the keystore never is.
 * Without configuration the list is empty, which simply means "no verified
 * links" instead of an error.
 */
export async function GET() {
  const fingerprints = (process.env.ANDROID_APP_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const body =
    fingerprints.length === 0
      ? []
      : [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: PACKAGE_NAME,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ];

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
