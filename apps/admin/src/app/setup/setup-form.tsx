"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { submitSuperAdmin, type FieldErrors } from "./submit";

/** Wording kept next to the input it explains. */
const HINTS = {
  email: "We use this to sign you in.",
  displayName: "How you will appear in the app.",
  password: "At least 12 characters.",
} as const;

/**
 * Setup wizard form (step 2). Step 1 is the environment checklist rendered by
 * the page. On 201 the user is already signed in (the route signs in with the
 * SSR client) and the form sends the browser to the next step of the wizard.
 */
export function SetupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    setFieldErrors({});

    const result = await submitSuperAdmin({ email, password, displayName });
    if (result.ok) {
      setStatus("done");
      router.push("/setup");
      router.refresh();
      return;
    }
    setStatus("idle");
    setError(result.message);
    setFieldErrors(result.fieldErrors);
  };

  return (
    <div className="w-full max-w-md rounded-card border border-border bg-surface p-6">
      <h1 className="mb-1 text-base font-extrabold tracking-tight">
        027<span className="text-accent">Apps</span>
      </h1>
      <h2 className="text-sm font-semibold">Step 2 · Super admin</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Welcome. Create the first super_admin to unlock the instance.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
            autoComplete="email"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby="setup-email-help"
            required
            className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <span
            id="setup-email-help"
            className={`text-xs ${fieldErrors.email ? "text-destructive" : "text-muted-foreground"}`}
          >
            {fieldErrors.email ?? HINTS.email}
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Eric"
            autoComplete="nickname"
            maxLength={80}
            aria-invalid={Boolean(fieldErrors.displayName)}
            aria-describedby="setup-display-name-help"
            required
            className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <span
            id="setup-display-name-help"
            className={`text-xs ${fieldErrors.displayName ? "text-destructive" : "text-muted-foreground"}`}
          >
            {fieldErrors.displayName ?? HINTS.displayName}
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Min 12 characters"
            minLength={12}
            autoComplete="new-password"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby="setup-password-help"
            required
            className="rounded-control border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <span
            id="setup-password-help"
            className={`text-xs ${fieldErrors.password ? "text-destructive" : "text-muted-foreground"}`}
          >
            {fieldErrors.password ?? HINTS.password}
          </span>
        </label>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Creating…" : "Create super admin"}
        </Button>
      </form>
    </div>
  );
}
