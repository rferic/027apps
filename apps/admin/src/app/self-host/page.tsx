import type { Metadata } from "next";
import { SelfHostLanding } from "@/components/landing/self-host-landing";
import { landingMetadata } from "@/lib/landing/metadata";
import { requestLocale } from "@/lib/request-locale";
import "../landing.css";

/** The language comes from the request, so this route is not static. */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return landingMetadata(locale, "selfhost");
}

/** The self-hosting landing, in the language of the request. */
export default async function SelfHostPage() {
  const locale = await requestLocale();
  return <SelfHostLanding locale={locale} />;
}
