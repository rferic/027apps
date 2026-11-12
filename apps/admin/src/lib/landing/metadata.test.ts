import { describe, expect, it } from "vitest";
import { landingMetadata } from "./metadata";

describe("landingMetadata", () => {
  it("translates the title and description", () => {
    const metadata = landingMetadata("es", "app");
    expect(metadata.title).toBe("027Apps — la app de tu familia");
    expect(metadata.description).toContain("familias");
  });

  it("declares the languages, canonical and social image", () => {
    const metadata = landingMetadata("de", "selfhost");
    expect(metadata.alternates?.canonical).toBe("/self-host");
    expect(metadata.alternates?.languages).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({
      locale: "de_DE",
      images: [expect.objectContaining({ url: "/og/landing.png" })],
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });
});
