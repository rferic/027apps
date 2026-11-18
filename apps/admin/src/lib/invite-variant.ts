/** Which invitation wizard the user agent gets. Pure: unit-tested. */
export type InviteVariant = "android" | "ios" | "desktop";

/**
 * The app exists for Android only, so the copy differs per platform. iPadOS
 * reports a desktop Safari user agent and gets the desktop variant, which is
 * correct: the QR is still useful there and the browser can redeem.
 */
export function inviteVariant(userAgent: string | null): InviteVariant {
  if (!userAgent) return "desktop";
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipod/i.test(userAgent)) return "ios";
  return "desktop";
}

/**
 * Scheme for the "Open in the app" button. A page served over plain HTTP is a
 * local instance, so the installed app is the debug build: its `-dev` scheme is
 * exclusive and cannot be intercepted by the stable app (which also registers
 * the production scheme). Production is HTTPS and uses the release scheme.
 */
export function inviteAppScheme(protocol: string): "zero27apps" | "zero27apps-dev" {
  return protocol === "http:" ? "zero27apps-dev" : "zero27apps";
}
