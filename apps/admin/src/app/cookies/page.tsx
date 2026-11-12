import type { Metadata } from "next";
import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import { landingMessages } from "@/lib/landing/i18n";
import { landingMetadata } from "@/lib/landing/metadata";
import { requestLocale } from "@/lib/request-locale";
import "../landing.css";

/** The language comes from the request, so this route is not static. */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return landingMetadata(locale, "cookies");
}

/** Public cookie policy, in the language of the request. */
export default async function CookiesPage() {
  const locale = await requestLocale();
  const messages = landingMessages(locale);
  const rows = [
    {
      name: "sb-*",
      purpose: t("Keeps the panel session signed in.", messages),
      type: t("Necessary", messages),
      duration: t("Until you sign out or it expires", messages),
    },
    {
      name: "027_locale",
      purpose: t("Remembers the language.", messages),
      type: t("Preference", messages),
      duration: t("1 year", messages),
    },
    {
      name: "027_theme",
      purpose: t("Remembers light or dark appearance.", messages),
      type: t("Preference", messages),
      duration: t("1 year", messages),
    },
    {
      name: "027_cookie_notice",
      purpose: t("Remembers that you closed the cookie notice.", messages),
      type: t("Preference", messages),
      duration: t("1 year", messages),
    },
  ];

  return (
    <div className="lp dark v2">
      <div className="wrap">
        <nav className="nav">
          <Link className="brand lockup" href="/">
            <svg
              className="pulse"
              viewBox="0 0 48 26"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline
                points="2,14 9,14 11.5,10 14,14 17,14 18.5,16.5 20.5,1.5 22.5,23 25,14 27,10.5 29.5,14 46,14"
                transform="translate(0,-1)"
              />
            </svg>
            <img src="/brand/wordmark-bare-dark.svg" alt="027Apps" height="22" />
          </Link>
          <Link className="btn ghost" href="/">
            {t("Back to the site", messages)}
          </Link>
        </nav>
      </div>

      <main className="wrap section policy">
        <p className="eyebrow">027Apps</p>
        <h1 className="display">{t("Cookie policy", messages)}</h1>
        <p className="lead">
          {t(
            "We use as few cookies as possible: the panel session and three preferences. No analytics, advertising or third-party cookies.",
            messages,
          )}
        </p>

        <table>
          <thead>
            <tr>
              <th>{t("Cookie", messages)}</th>
              <th>{t("Purpose", messages)}</th>
              <th>{t("Type", messages)}</th>
              <th>{t("Duration", messages)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td>
                  <code>{row.name}</code>
                </td>
                <td>{row.purpose}</td>
                <td>{row.type}</td>
                <td>{row.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p>
          {t(
            "You can delete or block cookies in your browser. Blocking the session cookie prevents signing in to the panel.",
            messages,
          )}
        </p>
      </main>
    </div>
  );
}
