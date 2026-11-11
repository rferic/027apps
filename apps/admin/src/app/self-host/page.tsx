import { SelfHostLanding } from "@/components/landing/self-host-landing";
import { landingMetadata } from "@/lib/landing/metadata";
import "../landing.css";

export const metadata = landingMetadata("en", "selfhost");

/** The self-hosting landing, in English. */
export default function SelfHostPage() {
  return <SelfHostLanding locale="en" />;
}
