import { AppLanding } from "@/components/landing/app-landing";
import { landingMetadata } from "@/lib/landing/metadata";
import "./landing.css";

export const metadata = landingMetadata("en", "app");

/** The family app landing, in English. */
export default function LandingPage() {
  return <AppLanding locale="en" />;
}
