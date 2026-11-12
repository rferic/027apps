import type { Metadata } from "next";
import { AppLanding } from "@/components/landing/app-landing";
import { landingMetadata } from "@/lib/landing/metadata";
import { requestLocale } from "@/lib/request-locale";
import "./landing.css";

/** The language comes from the request, so this route is not static. */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return landingMetadata(locale, "app");
}

/** The family app landing, in the language of the request. */
export default async function LandingPage() {
  const locale = await requestLocale();
  return <AppLanding locale={locale} />;
}
