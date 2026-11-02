"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { submitSuperAdmin } from "./submit";

/**
 * Setup wizard (steps 1–2). Step 1 is a visual guide to environment checks
 * (no API); step 2 is the super-admin creation form. On 201 the user is
 * already signed in (the route signs in with the SSR client) and the wizard
 * redirects to the dashboard.
 */
export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setError(null);

    const result = await submitSuperAdmin({ email, password, displayName });
    if (result.ok) {
      setStatus("done");
      router.push("/");
      return;
    }
    setStatus("idle");
    setError(result.message);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6">
        <h1 className="mb-1 text-lg font-bold">027 Apps</h1>
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
              required
              className="rounded-control border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Eric"
              required
              className="rounded-control border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Min 12 characters"
              required
              className="rounded-control border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Creating…" : "Create super admin"}
          </Button>
        </form>
      </div>
    </div>
  );
}

