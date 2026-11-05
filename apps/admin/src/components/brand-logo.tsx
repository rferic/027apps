import { cn } from "@/lib/cn";

const SIZES = {
  sm: "h-6",
  md: "h-8",
  lg: "h-10",
} as const;

/**
 * Instance brand. The default is the official 027Apps wordmark (light/dark
 * variants, switched by the OS theme); `instance.logo_url` replaces it with a
 * custom logo. The wordmark already contains the name, so no extra text is
 * rendered next to it.
 */
export function BrandLogo({
  logoUrl,
  size = "sm",
  className,
}: {
  logoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const custom = logoUrl?.trim();
  if (custom) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-provided URL, no optimizer
      <img src={custom} alt="027Apps" className={cn(SIZES[size], "w-auto", className)} />
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
