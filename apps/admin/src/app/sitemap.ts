import type { MetadataRoute } from "next";
import { LANDING_LANGUAGES, landingHref, type LandingPage } from "@/lib/landing/i18n";
import { SITE_URL } from "@/lib/site-url";

const PAGES: readonly LandingPage[] = ["app", "selfhost"];

/** The public site: both pages in the nine languages, with their alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PAGES.flatMap((page) =>
    LANDING_LANGUAGES.map(({ code }) => ({
      url: `${SITE_URL}${landingHref(code, page)}`,
      lastModified,
      changeFrequency: page === "app" ? "weekly" : "monthly",
      priority: page === "app" ? 1 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          LANDING_LANGUAGES.map(({ code: language }) => [
            language,
            `${SITE_URL}${landingHref(language, page)}`,
          ]),
        ),
      },
    })),
  );
}
