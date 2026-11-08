"use client";

import { useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { signInAction } from "../actions";
import { SubmitButton } from "../submit-button";

const SUBMIT_LABEL = "Sign in";
const INVALID_CREDENTIALS_MESSAGE = "Wrong email or password";
// English literal like the rest of this screen (localizing login is tracked
// debt): the notice follows the `?error=` pattern of the form.
const INVITATION_REDEEMED_MESSAGE =
  "Invitation accepted. Sign in with your email and password. If you already had an account, use your existing password.";

/**
 * Login form. Reads the auth failure from `?error=` and the invitation notice
 * from `?notice=` in the URL. Kept in its own component so
 * `useSearchParams()` sits inside a Suspense boundary during prerendering.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const hasError = searchParams.get("error") === "invalid_credentials";
  const hasInvitationNotice = searchParams.get("notice") === "invitation-redeemed";

  return (
    <form
      action={signInAction}
      className="flex w-full max-w-md flex-col gap-3 rounded-card border border-border bg-surface p-6"
    >
      <BrandLogo size="lg" className="mx-auto" />
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
      {hasInvitationNotice && (
        <p className="text-xs text-muted-foreground">{INVITATION_REDEEMED_MESSAGE}</p>
      )}
      {hasError && <p className="text-xs text-destructive">{INVALID_CREDENTIALS_MESSAGE}</p>}
      <SubmitButton label={SUBMIT_LABEL} />
    </form>
  );
}
