"use client";

import { useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { signInAction } from "../actions";
import { SubmitButton } from "../submit-button";

const SUBMIT_LABEL = "Sign in";
const INVALID_CREDENTIALS_MESSAGE = "Wrong email or password";

/**
 * Login form. Reads the auth failure from `?error=` in the URL. Kept in its own
 * component so `useSearchParams()` sits inside a Suspense boundary during
 * prerendering.
 */
export function LoginForm({ logoUrl }: { logoUrl?: string | null }) {
  const searchParams = useSearchParams();
  const hasError = searchParams.get("error") === "invalid_credentials";

  return (
    <form
      action={signInAction}
      className="flex w-full max-w-md flex-col gap-3 rounded-card border border-border bg-surface p-6"
    >
      <BrandLogo logoUrl={logoUrl} size="lg" className="mx-auto" />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          placeholder="admin@example.com"
          required
          className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Password</span>
        <input
          type="password"
          name="password"
          placeholder="Your password"
          required
          className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
        />
      </label>
      {hasError && <p className="text-xs text-destructive">{INVALID_CREDENTIALS_MESSAGE}</p>}
      <SubmitButton label={SUBMIT_LABEL} />
    </form>
  );
}
