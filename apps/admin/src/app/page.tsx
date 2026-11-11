import type { Metadata } from "next";
import { AppLanding } from "@/components/landing/app-landing";
import { LANDING_LANGUAGES, landingHref } from "@/lib/landing/i18n";
import "./landing.css";

export const metadata: Metadata = {
  title: "027Apps \u2014 your family app",
  description:
    "A self-hostable modular platform for families: finances, members and modules on your phone.",
  alternates: {
    canonical: landingHref("en", "app"),
    languages: {
      ...Object.fromEntries(
        LANDING_LANGUAGES.map(({ code }) => [code, landingHref(code, "app")]),
      ),
      "x-default": landingHref("en", "app"),
    },
  },
};

/** The family app landing, in English. */
export default function LandingPage() {
  return <AppLanding locale="en" />;
}
