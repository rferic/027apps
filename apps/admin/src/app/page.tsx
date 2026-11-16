import type { Metadata } from "next";
import { connection } from "next/server";
import { AppLanding } from "@/components/landing/app-landing";
import { landingMetadata } from "@/lib/landing/metadata";
import { latestAndroidRelease } from "@/lib/android-release";
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
  // Request-time, not prerender: the release lookup keeps a five-minute cache
  // with `Date.now()`, and Next refuses that value while generating the static
  // shell (production returned an error page and the landing went blank).
  await connection();
  const locale = await requestLocale();
  // The version under the download button is the one the button actually
  // serves: the same lookup as `/download/android`, cached five minutes.
  const release = await latestAndroidRelease().catch(() => null);
  return <AppLanding locale={locale} version={release?.versionName ?? null} />;
}
