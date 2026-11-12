import type { MetadataRoute } from "next";
import { landingHref, type LandingPage } from "@/lib/landing/i18n";
import { SITE_URL } from "@/lib/site-url";

const PAGES: readonly LandingPage[] = ["app", "selfhost", "cookies"];

/** The public site: both pages in the nine languages, with their alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PAGES.map((page) => ({
    url: `${SITE_URL}${landingHref("en", page)}`,
    lastModified,
    changeFrequency: page === "app" ? "weekly" : "monthly",
    priority: page === "app" ? 1 : 0.8,
  }));
}
