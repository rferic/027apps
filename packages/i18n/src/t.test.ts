import { describe, expect, it } from "vitest";
import { t } from "./t.js";

describe("t — translation and interpolation", () => {
  it("returns the translated text when the map has the key", () => {
    expect(t("Email", { Email: "Correo" })).toBe("Correo");
  });

  it("falls back to the English text when the map has no entry", () => {
    expect(t("Email", {})).toBe("Email");
    expect(t("Email", null)).toBe("Email");
  });

  it("interpolates parameters found in the text", () => {
    expect(t("Hello {name}", undefined, { name: "Eric" })).toBe("Hello Eric");
    expect(
      t("Hello {name}", { "Hello {name}": "Hola {name}" }, { name: "Eric" }),
    ).toBe("Hola Eric");
  });

  it("leaves a placeholder untouched when its parameter is missing", () => {
    expect(t("Hello {name}", undefined, {})).toBe("Hello {name}");
  });

  it("renders numeric parameters as text", () => {
    expect(t("Expires in {seconds} s", undefined, { seconds: 900 })).toBe(
      "Expires in 900 s",
    );
  });

  it("leaves text without placeholders unchanged", () => {
    expect(t("Email")).toBe("Email");
    expect(t("100% done")).toBe("100% done");
  });
});
