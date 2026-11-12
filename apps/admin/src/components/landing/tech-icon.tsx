import type { ReactNode } from "react";

export type TechName =
  | "next"
  | "react"
  | "typescript"
  | "supabase"
  | "tailwind"
  | "kotlin"
  | "pnpm"
  | "vercel"
  | "resend"
  | "mit";

/** Line icons for the self-host technology cards (concept, not brand art). */
export function TechIcon({ name }: { name: TechName }) {
  const paths: Record<TechName, ReactNode> = {
    next: (
      <>
        <rect x="3" y="4" width="18" height="7" rx="2" />
        <rect x="3" y="13" width="18" height="7" rx="2" />
        <path d="M7 7.5h.01M7 16.5h.01" />
      </>
    ),
    react: (
      <>
        <circle cx="12" cy="12" r="2" />
        <ellipse cx="12" cy="12" rx="9" ry="4" />
        <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)" />
      </>
    ),
    typescript: (
      <path d="M9 4c-2 0-2 3-2 4s-1 2-2 2c1 0 2 1 2 2s0 4 2 4M15 4c2 0 2 3 2 4s1 2 2 2c-1 0-2 1-2 2s0 4-2 4" />
    ),
    supabase: (
      <>
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </>
    ),
    tailwind: (
      <path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8a2.5 2.5 0 1 1-2.5 2.5" />
    ),
    kotlin: (
      <>
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
        <path d="M10.5 5h3" />
      </>
    ),
    pnpm: (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
      </>
    ),
    vercel: <path d="M12 4 21 20H3L12 4Z" />,
    resend: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3.5 6.5 8.5 6 8.5-6" />
      </>
    ),
    mit: <path d="M12 3v18M5 7h14M7 7l-3 6h6L7 7ZM17 7l-3 6h6l-3-6Z" />,
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
