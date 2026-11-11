/**
 * Shared shell of every transactional email: 600 px, one column, table layout,
 * inline light styles and a dark palette applied by `prefers-color-scheme`.
 *
 * Class names are part of the contract with the templates:
 * `email-bg`, `email-card`, `email-text`, `email-muted`, `email-cta`,
 * `email-link`, `email-note`, `email-hr`, `logo-light`, `logo-dark`.
 */
export interface EmailLayoutInput {
  locale: string;
  /** Hidden preview text shown by the inbox list. */
  preheader: string;
  /** A single lockup that reads on both the light and the dark card. */
  logo: { url: string; alt: string };
  /** Middle of the card, already escaped and built by the template. */
  body: string;
  /** Small print under the card. */
  footer: string;
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const STYLE = `
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table{border-collapse:collapse}
  img{border:0;line-height:100%;outline:none;text-decoration:none}
  @media (prefers-color-scheme: dark){
    .email-bg{background:#08090a!important}
    .email-card{background:#0e0f11!important;border-color:rgba(255,255,255,.09)!important}
    .email-text{color:#f7f8f8!important}
    .email-muted{color:#8a8f98!important}
    .email-cta{background:#1cc29f!important;color:#06110d!important}
    .email-link{color:#1cc29f!important}
    .email-note{background:#1a1b1e!important}
    .email-note-text{color:#f7f8f8!important}
    .email-hr{border-color:rgba(255,255,255,.09)!important}
  }
`;

export function renderEmailLayout(input: EmailLayoutInput): string {
  return `<!doctype html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${input.preheader}</title>
<style>${STYLE}</style>
</head>
<body class="email-bg" style="margin:0;padding:0;background:#f6f7f8">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${input.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-bg" bgcolor="#f6f7f8" style="background:#f6f7f8">
<tr>
<td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-card" bgcolor="#ffffff" style="width:600px;max-width:100%;background:#ffffff;border:1px solid #e3e5e8;border-radius:12px">
<tr>
<td style="padding:40px 36px 32px;font-family:${FONT};text-align:center">
<img class="logo" src="${input.logo.url}" width="156" height="24" alt="${input.logo.alt}" style="display:block;margin:0 auto 28px;width:156px;height:24px">
${input.body}
</td>
</tr>
</table>
<p class="email-muted" style="margin:16px 0 0;font-family:${FONT};font-size:11px;line-height:1.7;color:#5b6472">${input.footer}</p>
</td>
</tr>
</table>
</body>
</html>`;
}
