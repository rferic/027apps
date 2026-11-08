/**
 * The instance brand mark: the heartbeat glyph rendered inline so `currentColor`
 * resolves against the parent's text colour (`text-brand` in the panel header).
 * As an `<img src="…svg">` the SVG is its own document and `currentColor`
 * falls back to black, so the mark must stay inline.
 */
interface BrandMarkProps {
  className?: string;
  /** Accessible name; when absent the glyph is decorative. */
  label?: string;
  /** Native tooltip; also used as the accessible name when `label` is absent. */
  title?: string;
}

export function BrandMark({ className, label, title }: BrandMarkProps) {
  const accessibleName = label?.trim() || title?.trim();

  return (
    <svg
      viewBox="0 0 48 26"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={accessibleName ? "img" : undefined}
      aria-label={accessibleName || undefined}
      aria-hidden={accessibleName ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <polyline
        points="2,14 9,14 11.5,10 14,14 17,14 18.5,16.5 20.5,1.5 22.5,23 25,14 27,10.5 29.5,14 46,14"
        transform="translate(0,-1)"
      />
    </svg>
  );
}
