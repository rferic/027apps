import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dialog } from "./dialog";

describe("Dialog", () => {
  it("renders a native dialog named by its title with foreground text on the surface", () => {
    const html = renderToStaticMarkup(
      <Dialog labelledBy="example-title">
        <h2 id="example-title">Título</h2>
      </Dialog>,
    );

    expect(html).toContain("<dialog");
    expect(html).toContain('aria-labelledby="example-title"');
    expect(html).toContain("text-foreground");
    expect(html).toContain("bg-surface");
  });

  it("keeps the shared backdrop token", () => {
    const html = renderToStaticMarkup(
      <Dialog labelledBy="example-title">
        <h2 id="example-title">Título</h2>
      </Dialog>,
    );

    expect(html).toContain("backdrop:bg-foreground/40");
  });

  it("never touches the viewport edges on mobile and stays scrollable", () => {
    const html = renderToStaticMarkup(
      <Dialog labelledBy="example-title">
        <h2 id="example-title">Título</h2>
      </Dialog>,
    );

    expect(html).toContain("w-[calc(100vw-2rem)]");
    expect(html).toContain("max-w-md");
    expect(html).toContain("max-h-[85vh]");
    expect(html).toContain("overflow-y-auto");
  });

  it("forwards extra classes without losing the shared pattern", () => {
    const html = renderToStaticMarkup(
      <Dialog labelledBy="example-title" className="max-w-lg">
        <h2 id="example-title">Título</h2>
      </Dialog>,
    );

    expect(html).toContain("max-w-lg");
    expect(html).toContain("text-foreground");
  });
});
