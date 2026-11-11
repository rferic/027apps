import type { Metadata } from "next";
import { SelfHostLanding } from "@/components/landing/self-host-landing";
import { LANDING_LANGUAGES, landingHref } from "@/lib/landing/i18n";
import "../landing.css";

export const metadata: Metadata = {
  title: "Self-host 027Apps",
  description:
    "Run 027Apps on your own Vercel and Supabase: the desktop panel, API v1 and MCP.",
  alternates: {
    canonical: landingHref("en", "selfhost"),
    languages: {
      ...Object.fromEntries(
        LANDING_LANGUAGES.map(({ code }) => [code, landingHref(code, "selfhost")]),
      ),
      "x-default": landingHref("en", "selfhost"),
    },
  },
};

/** The self-hosting landing, in English. */
export default function SelfHostPage() {
  return <SelfHostLanding locale="en" />;
}
