/** Locales the invitation email can be written in (same set as the panel). */
export const EMAIL_LOCALES = ["en", "es", "ca", "gl", "eu", "pt", "fr", "it", "de"] as const;

export type EmailLocale = (typeof EMAIL_LOCALES)[number];

/** One rendered message: the provider gets all three parts. */
export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

/** Every string the invitation email needs, per locale. */
export interface EmailCopy {
  subject: string;
  preheader: string;
  greeting: string;
  lead: string;
  cta: string;
  fallback: string;
  expiry: string;
  security: string;
  footer: string;
}

export interface InvitationEmailInput {
  locale: EmailLocale;
  /** Name of the person receiving the invitation. */
  inviteeName: string;
  /** Display name of the admin who created it. */
  inviterName: string;
  /** `instance.name` setting. */
  instanceName: string;
  /** `instance.public_url`, without a trailing slash. */
  publicUrl: string;
  /** Time zone for the expiry date (`localization.timezone`). */
  timeZone: string;
  token: string;
  expiresAt: Date;
}

export function isEmailLocale(value: unknown): value is EmailLocale {
  return typeof value === "string" && (EMAIL_LOCALES as readonly string[]).includes(value);
}
