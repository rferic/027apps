import { Suspense } from "react";
import { LoginForm } from "./login-form";

/**
 * Login page (email + password). The session cookie is set by the server
 * action via @supabase/ssr (`HttpOnly`/`Secure`/`SameSite`), so credentials
 * never touch client JS. Auth failures come back as `?error=` in the URL.
 */
export const instant = false;

export default function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
