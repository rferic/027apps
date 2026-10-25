import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Contraste WCAG AA (4.5:1 para texto normal) del badge success sobre --surface en claro.
// Se compone el tinte (success-subtle, rgba con alpha) sobre la superficie y se compara
// con el texto (--success). Criterio de aceptación de la spec (fidelidad AA).
const mirror = JSON.parse(
  readFileSync(
    join(fileURLToPath(new URL(".", import.meta.url)), "../../../tokens.json"),
    "utf8",
  ),
);

const toRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const luminance = (hex: string): number => {
  const [r, g, b] = toRgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Compone un rgba(c, m, a, alpha) sobre un fondo hex. */
const composite = (rgba: string, base: string): string => {
  const [, c, m, a, alphaStr] = rgba.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/)!;
  const alpha = Number(alphaStr);
  const mix = (channel: number, baseChannel: number) =>
    Math.round(channel * alpha + baseChannel * (1 - alpha));
  const [r, g, b] = toRgb(base);
  const [cr, cg, cb] = [Number(c), Number(m), Number(a)];
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${[mix(cr, r), mix(cg, g), mix(cb, b)].map(toHex).join("")}`;
};

describe("Contraste AA del badge success", () => {
  const light = mirror.light;

  it("el texto --success sobre el tinte compuesto sobre --surface cumple AA (>= 4.5:1)", () => {
    const tinted = composite(light["success-subtle"], light.surface);
    expect(contrast(light.success, tinted)).toBeGreaterThanOrEqual(4.5);
  });

  it("el tinte --success-subtle está definido en claro y oscuro", () => {
    expect(light["success-subtle"]).toMatch(/^rgba\(/);
    expect(mirror.dark["success-subtle"]).toMatch(/^rgba\(/);
  });
});