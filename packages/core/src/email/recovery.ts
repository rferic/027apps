import { RECOVERY_COPY } from "./recovery-catalog";
import { renderEmailLayout } from "./layout";
import { escapeHtml } from "./invitation";
import type { EmailMessage, RecoveryEmailInput } from "./types";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key]! : match,
  );
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Password-recovery email. The link is built by the service (it carries the
 * Supabase token hash) and is the only place the token appears; the copy never
 * includes it. Pure: no network, no clock.
 */
export function buildRecoveryEmail(input: RecoveryEmailInput): EmailMessage {
  const copy = RECOVERY_COPY[input.locale] ?? RECOVERY_COPY.en;
  const base = input.publicUrl.replace(/\/+$/, "");
  const href = input.link;

  const raw = { name: input.name, instance: input.instanceName };
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
<tr><td class="email-note-text" style="padding:10px 14px;font-family:${FONT};font-size:13px;line-height:1.5;color:#17191c;text-align:center">${copy.expiry}</td></tr>
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
    copy.expiry,
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
      logo: { url: `${base}/brand/email-lockup.png`, alt: "027Apps" },
      body,
      footer: fill(copy.footer, html),
    }),
    text,
  };
}
