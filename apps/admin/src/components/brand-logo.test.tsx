import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo", () => {
  it("renders the official wordmark in both theme variants by default", () => {
    const html = renderToStaticMarkup(<BrandLogo />);

    expect(html).toContain("/brand/wordmark-light.svg");
    expect(html).toContain("/brand/wordmark-dark.svg");
    expect(html).toContain('alt="027Apps"');
  });

  it("uses a custom logo when instance.logo_url is set", () => {
    const html = renderToStaticMarkup(<BrandLogo logoUrl="https://example.com/logo.png" />);

    expect(html).toContain("https://example.com/logo.png");
    expect(html).not.toContain("/brand/wordmark-light.svg");
  });

  it("falls back to the wordmark when the setting is empty", () => {
    const html = renderToStaticMarkup(<BrandLogo logoUrl="   " />);

    expect(html).toContain("/brand/wordmark-light.svg");
  });
});
