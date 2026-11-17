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
  /** The address already has an account: sign in instead of choosing a password. */
  existingLead: string;
  existingCta: string;
  /** Shown in the note box for an existing account (D16). */
  passwordNote: string;
  /** Shown in the note box when the invitation grants an admin role (A6). */
  adminNote: string;
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
  /** The address already has an account: send the "sign in" variant. */
  accountExists?: boolean;
  /** Role the invitation grants; `admin` adds a note. */
  role?: "user" | "admin";
}

/** Copy of the password-recovery email, per locale. */
export interface RecoveryCopy {
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

export interface RecoveryEmailInput {
  locale: EmailLocale;
  /** Display name of the account, or its email when the profile has none. */
  name: string;
  /** `instance.name` setting. */
  instanceName: string;
  /** `instance.public_url`, without a trailing slash (logo and base URL). */
  publicUrl: string;
  /** Absolute `/auth/confirm?...` link with the token hash. */
  link: string;
}

export function isEmailLocale(value: unknown): value is EmailLocale {
  return typeof value === "string" && (EMAIL_LOCALES as readonly string[]).includes(value);
}
