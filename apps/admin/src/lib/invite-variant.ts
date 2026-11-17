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
