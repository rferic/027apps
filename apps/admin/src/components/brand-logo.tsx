import { cn } from "@/lib/cn";
import { BrandMark } from "./brand-mark";

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
 * variants, switched by the OS theme).
 *
 * `variant="mark"` renders the heartbeat glyph alone, in the brand colour, for
 * the panel header where the instance name sits next to it (ADR 0003, L4).
 */
export function BrandLogo({
  name,
  size = "sm",
  variant = "wordmark",
  className,
}: {
  /** Accessible name for the mark; the wordmark keeps the product name. */
  name?: string;
  size?: keyof typeof SIZES;
  /** `wordmark` is the full logo; `mark` is the heartbeat glyph only. */
  variant?: "wordmark" | "mark";
  className?: string;
}) {
  if (variant === "mark") {
    return (
      <span className={cn("flex items-center text-[color:var(--brand)]", MARK_WIDTHS[size], className)}>
        <BrandMark className="h-auto w-full" label={name?.trim() || "027Apps"} />
      </span>
    );
  }

  return (
    <span className={cn("flex items-center", SIZES[size], className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
      <img src="/brand/wordmark-light.svg" alt="027Apps" className="brand-wordmark-light h-full w-auto" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
      <img src="/brand/wordmark-dark.svg" alt="027Apps" className="brand-wordmark-dark h-full w-auto" />
    </span>
  );
}
