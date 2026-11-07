import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandMark } from "./brand-mark";

describe("BrandMark", () => {
  it("renders the heartbeat glyph inline so it inherits currentColor", () => {
    const html = renderToStaticMarkup(<BrandMark label="027Apps" className="h-auto w-full" />);

    expect(html).toContain("<svg");
    expect(html).toContain('viewBox="0 0 48 26"');
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="3.4"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).toContain('stroke-linejoin="round"');
    expect(html).toContain('transform="translate(0,-1)"');
    expect(html).toContain(
      'points="2,14 9,14 11.5,10 14,14 17,14 18.5,16.5 20.5,1.5 22.5,23 25,14 27,10.5 29.5,14 46,14"',
    );
    expect(html).toContain('class="h-auto w-full"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="027Apps"');
  });

  it("is decorative when no accessible label is provided", () => {
    const html = renderToStaticMarkup(<BrandMark />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
  });

  it("falls back to the title as accessible name", () => {
    const html = renderToStaticMarkup(<BrandMark title="Familia García" />);

    expect(html).toContain('aria-label="Familia García"');
    expect(html).toContain("<title>Familia García</title>");
  });
});
