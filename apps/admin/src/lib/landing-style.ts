import type { CSSProperties } from "react";

/**
 * Turns the landing's inline style strings (`height: 62%`) into React's style
 * object. The landing is ported from the approved mockup, where sizes and bar
 * heights live inline; this keeps that markup intact without a parser.
 */
export function s(css: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const rule of css.split(";")) {
    const [property, ...rest] = rule.split(":");
    const value = rest.join(":").trim();
    if (!property || !value) continue;
    const key = property.trim().replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
    style[key] = value;
  }
  return style as CSSProperties;
}
