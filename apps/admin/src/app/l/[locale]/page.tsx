import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppLanding } from "@/components/landing/app-landing";
import { LANDING_LOCALES, isLandingLocale } from "@/lib/landing/i18n";
import { landingMetadata } from "@/lib/landing/metadata";
import "../../landing.css";

export function generateStaticParams() {
  return LANDING_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/l/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLandingLocale(locale)) return {};
  return landingMetadata(locale, "app");
}

/**
 * The family app landing in one of the translated languages.
 *
 * `params` is URL data, so reading it suspends. The page stays synchronous and
 * the read happens inside a Suspense boundary, which is what keeps the
 * navigation instant under Cache Components.
 */
export default function LocalizedLandingPage({
  params,
}: PageProps<"/l/[locale]">) {
  return (
    <Suspense fallback={null}>
      <LocalizedLanding params={params} />
    </Suspense>
  );
}

async function LocalizedLanding({
  params,
}: {
  params: PageProps<"/l/[locale]">["params"];
}) {
  const { locale } = await params;
  if (!isLandingLocale(locale) || locale === "en") notFound();
  return <AppLanding locale={locale} />;
}
