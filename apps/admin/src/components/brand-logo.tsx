import { cn } from "@/lib/cn";

const SIZES = {
  sm: "h-6",
  md: "h-8",
  lg: "h-10",
  xl: "h-12",
} as const;

/** The mark is sized by width: its SVG is wider than tall (48×26). */
const MARK_WIDTHS = { sm: "w-6", md: "w-8", lg: "w-10", xl: "w-12" } as const;

/**
 * Instance brand. The default is the official 027Apps wordmark (light/dark
 * variants, switched by the OS theme); `instance.logo_url` replaces it with a
 * custom logo, whose alternative text is the instance name.
 *
 * `variant="mark"` renders the heartbeat glyph alone, in the brand colour, for
 * the panel header where the instance name sits next to it (ADR 0003, L4).
 */
export function BrandLogo({
  logoUrl,
  name,
  size = "sm",
  variant = "wordmark",
  className,
}: {
  logoUrl?: string | null;
  /** Accessible name for a custom logo; the wordmark keeps the product name. */
  name?: string;
  size?: keyof typeof SIZES;
  /** `wordmark` is the full logo; `mark` is the heartbeat glyph only. */
  variant?: "wordmark" | "mark";
  className?: string;
}) {
  const custom = logoUrl?.trim();
  if (custom) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-provided URL, no optimizer
      <img src={custom} alt={name?.trim() || "027Apps"} className={cn(SIZES[size], "w-auto", className)} />
    );
  }

  if (variant === "mark") {
    return (
      <span className={cn("flex items-center text-brand", MARK_WIDTHS[size], className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
        <img src="/brand/mark.svg" alt="027Apps" className="h-auto w-full" />
      </span>
    );
  }

  return (
    <span className={cn("flex items-center", SIZES[size], className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
      <img src="/brand/wordmark-light.svg" alt="027Apps" className="h-full w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
      <img src="/brand/wordmark-dark.svg" alt="027Apps" className="hidden h-full w-auto dark:block" />
    </span>
  );
}
