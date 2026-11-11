import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SelfHostLanding } from "@/components/landing/self-host-landing";
import { LANDING_LOCALES, isLandingLocale } from "@/lib/landing/i18n";
import { landingMetadata } from "@/lib/landing/metadata";
import "../../../landing.css";

export function generateStaticParams() {
  return LANDING_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/l/[locale]/self-host">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLandingLocale(locale)) return {};
  return landingMetadata(locale, "selfhost");
}

/**
 * The self-hosting landing in one of the translated languages.
 *
 * `params` is URL data, so reading it suspends. The page stays synchronous and
 * the read happens inside a Suspense boundary, which is what keeps the
 * navigation instant under Cache Components.
 */
export default function LocalizedSelfHostPage({
  params,
}: PageProps<"/l/[locale]/self-host">) {
  return (
    <Suspense fallback={null}>
      <LocalizedSelfHost params={params} />
    </Suspense>
  );
}

async function LocalizedSelfHost({
  params,
}: {
  params: PageProps<"/l/[locale]/self-host">["params"];
}) {
  const { locale } = await params;
  if (!isLandingLocale(locale) || locale === "en") notFound();
  return <SelfHostLanding locale={locale} />;
}
