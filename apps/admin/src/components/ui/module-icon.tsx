/**
 * A module's icon, painted as a CSS mask so the monochrome SVG takes the
 * current text color and works in both themes. The panel route authenticates
 * with the session cookie; the SVG never reaches the DOM as markup.
 */
export function ModuleIcon({
  moduleKey,
  size = 16,
  className = "",
  color,
}: {
  moduleKey: string;
  size?: number;
  className?: string;
  /** Manifest `branding.color`; falls back to the surrounding text color. */
  color?: string;
}) {
  const url = `url(/panel/modules/${encodeURIComponent(moduleKey)}/icon)`;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width: size,
        height: size,
        color: color ? `var(--module-${color}, currentColor)` : undefined,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
