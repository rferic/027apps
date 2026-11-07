import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Select } from "./select";

describe("Select", () => {
  it("renders a native select with the shared control classes", () => {
    const html = renderToStaticMarkup(
      <Select aria-label="Estado" defaultValue="all">
        <option value="all">Todos</option>
      </Select>,
    );

    expect(html).toContain("<select");
    for (const className of [
      "h-9",
      "sm:h-10",
      "rounded-control",
      "border-border",
      "bg-background",
      "px-3",
      "pr-8",
      "text-sm",
      "text-foreground",
      "appearance-none",
      "focus-visible:outline-2",
      "focus-visible:outline-accent",
      "disabled:opacity-50",
      "min-h-11",
    ]) {
      expect(html, `missing ${className}`).toContain(className);
    }
  });

  it("renders a decorative chevron on the right", () => {
    const html = renderToStaticMarkup(<Select aria-label="Estado" />);

    expect(html).toContain("<svg");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("pointer-events-none");
    expect(html).toContain("text-muted-foreground");
  });

  it("forwards aria attributes and native props", () => {
    const html = renderToStaticMarkup(
      <Select
        aria-label="Rol"
        aria-invalid
        aria-describedby="role-error"
        name="role"
        disabled
        className="w-full"
      />,
    );

    expect(html).toContain('aria-label="Rol"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="role-error"');
    expect(html).toContain('name="role"');
    expect(html).toContain("disabled");
    expect(html).toContain("w-full");
  });
});
