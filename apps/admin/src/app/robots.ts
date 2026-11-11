import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/** Index the landing; keep the panel, the API and the private flows out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/panel", "/api/", "/setup", "/invite/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
