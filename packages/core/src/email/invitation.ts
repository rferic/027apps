import { EMAIL_COPY } from "./catalog";
import { renderEmailLayout } from "./layout";
import type { EmailMessage, InvitationEmailInput } from "./types";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Escapes every interpolated value; the copy itself is trusted. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** `{publicUrl}/invite/{token}` with no double slash. */
export function invitationUrl(publicUrl: string, token: string): string {
  return `${publicUrl.replace(/\/+$/, "")}/invite/${encodeURIComponent(token)}`;
}

/** Header values cannot carry line breaks (header injection). */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function formatExpiry(date: Date, locale: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }).format(date);
  }
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key]! : match,
  );
}

/**
 * Builds the invitation email approved on 2026-11-11 (mockup `v1`, logo A):
 * card, lockup, greeting, inviter, CTA, fallback link, explicit expiry and a
 * security notice. Pure: no network, no clock.
 */
export function buildInvitationEmail(input: InvitationEmailInput): EmailMessage {
  const copy = EMAIL_COPY[input.locale] ?? EMAIL_COPY.en;
  const base = input.publicUrl.replace(/\/+$/, "");
  const href = invitationUrl(base, input.token);
  const date = formatExpiry(input.expiresAt, input.locale, input.timeZone);

  const raw = {
    name: input.inviteeName,
    inviter: input.inviterName,
    instance: input.instanceName,
    date,
  };
  const html = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, escapeHtml(value)]),
  ) as Record<string, string>;

  const body = `
<h1 class="email-text" style="margin:0 0 10px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:600;color:#17191c">${fill(copy.greeting, html)}</h1>
<p class="email-muted" style="margin:0 0 26px;font-family:${FONT};font-size:15px;line-height:1.6;color:#5b6472">${fill(copy.lead, html)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 22px">
<tr><td align="center" bgcolor="#09795f" style="border-radius:8px">
<a class="email-cta" href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:8px">${copy.cta}</a>
</td></tr>
</table>
<p class="email-muted" style="margin:0 0 22px;font-family:${FONT};font-size:12px;line-height:1.7;color:#5b6472;word-break:break-all">${copy.fallback}<br><a class="email-link" href="${escapeHtml(href)}" style="color:#09795f">${escapeHtml(href)}</a></p>
<table role="presentation" width="380" cellpadding="0" cellspacing="0" border="0" align="center" class="email-note" bgcolor="#eceef0" style="width:380px;max-width:100%;margin:0 auto 22px;background:#eceef0;border-radius:8px">
<tr><td class="email-note-text" style="padding:10px 14px;font-family:${FONT};font-size:13px;line-height:1.5;color:#17191c;text-align:center">${fill(copy.expiry, html)}</td></tr>
</table>
<hr class="email-hr" style="border:0;border-top:1px solid #e3e5e8;margin:0 0 18px">
<p class="email-muted" style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:#5b6472;text-align:left">${copy.security}</p>`;

  const text = [
    fill(copy.greeting, raw),
    "",
    fill(copy.lead, raw),
    "",
    `${copy.cta}: ${href}`,
    "",
    copy.fallback,
    href,
    "",
    fill(copy.expiry, raw),
    "",
    copy.security,
    "",
    fill(copy.footer, raw),
  ].join("\n");

  return {
    subject: singleLine(fill(copy.subject, raw)),
    html: renderEmailLayout({
      locale: input.locale,
      preheader: fill(copy.preheader, html),
      logo: {
        light: `${base}/brand/email-lockup-light.png`,
        dark: `${base}/brand/email-lockup-dark.png`,
        alt: "027Apps",
      },
      body,
      footer: fill(copy.footer, html),
    }),
    text,
  };
}
