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

  it("renders the mark inline in brand colour at the requested width when variant is mark", () => {
    const html = renderToStaticMarkup(
      <BrandLogo variant="mark" size="md" name="Familia García" />,
    );

    expect(html).toMatch(/<span class="[^"]*text-\[color:var\(--brand\)\][^"]*"><svg/);
    expect(html).not.toContain("text-brand");
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Familia García"');
    expect(html).not.toContain("/brand/mark.svg");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("text-accent");
    expect(html).toContain("w-8");
    expect(html).not.toContain("h-8");
    expect(html).not.toContain("h-10");
    expect(html).not.toContain("/brand/wordmark-light.svg");
  });

  it("uses the product name as the mark's accessible name when no instance name is given", () => {
    const html = renderToStaticMarkup(<BrandLogo variant="mark" />);

    expect(html).toContain('aria-label="027Apps"');
  });

  it("keeps the wordmark when no variant is given", () => {
    const html = renderToStaticMarkup(<BrandLogo size="lg" />);

    expect(html).toContain("/brand/wordmark-light.svg");
    expect(html).not.toContain("/brand/mark.svg");
  });
});
