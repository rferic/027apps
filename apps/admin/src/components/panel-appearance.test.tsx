import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PanelAppearance } from "./panel-appearance";

describe("PanelAppearance", () => {
  it("renders no markup, so React never sees a script tag in the stream", () => {
    expect(renderToStaticMarkup(<PanelAppearance theme="dark" locale="es" />)).toBe("");
  });
});
