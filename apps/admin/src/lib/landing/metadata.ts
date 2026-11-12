import type { Metadata } from "next";
import { t } from "@027apps/i18n/t.js";
import type { Locale } from "@027apps/i18n/types.js";
import { landingHref, landingMessages, ogLocale, type LandingPage } from "./i18n";

/** Title, description and alternates for one landing page in one language. */
export function landingMetadata(locale: Locale, page: LandingPage): Metadata {
  const messages = landingMessages(locale);
  const title =
    page === "app"
      ? t("027Apps — your family app", messages)
      : page === "selfhost"
        ? t("Self-host 027Apps", messages)
        : t("Cookie policy", messages);
  const description =
    page === "app"
      ? t(
          "A self-hostable modular platform for families: finances, members and modules on your phone.",
          messages,
        )
      : page === "selfhost"
        ? t(
            "Run 027Apps on your own Vercel and Supabase: the desktop panel, API v1 and MCP.",
            messages,
          )
        : t("The cookies 027Apps uses on the public site and in the panel.", messages);

  const image = {
    url: "/og/landing.png",
    width: 1200,
    height: 630,
    alt: title,
  };

  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "027Apps",
      title,
      description,
      url: landingHref(locale, page),
      locale: ogLocale(locale),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    alternates: { canonical: landingHref(locale, page) },
  };
}
