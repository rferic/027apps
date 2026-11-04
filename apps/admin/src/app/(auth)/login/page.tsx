"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signInAction } from "../actions";
import { SubmitButton } from "../submit-button";

const SUBMIT_LABEL = "Sign in";
const INVALID_CREDENTIALS_MESSAGE = "Wrong email or password";

/**
 * Login form. Reads the auth failure from `?error=` in the URL. Kept in its own
 * component so `useSearchParams()` sits inside a Suspense boundary during
 * prerendering.
 */
function LoginForm() {
  const searchParams = useSearchParams();
  const hasError = searchParams.get("error") === "invalid_credentials";

  return (
    <form
      action={signInAction}
      className="flex w-full max-w-md flex-col gap-3 rounded-card border border-border bg-surface p-6"
    >
      <h1 className="text-base font-extrabold tracking-tight">
        027<span className="text-accent">Apps</span>
      </h1>
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

/**
 * Login page (email + password). The session cookie is set by the server
 * action via @supabase/ssr (`HttpOnly`/`Secure`/`SameSite`), so credentials
 * never touch client JS. Auth failures come back as `?error=` in the URL.
 */
export default function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
