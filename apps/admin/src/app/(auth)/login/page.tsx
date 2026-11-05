import { Suspense } from "react";
import { readPublicSettings } from "@027apps/core/settings/service.js";
import { getInfra } from "@/lib/api/door";
import { LoginForm } from "./login-form";

/**
 * Login page (email + password). The session cookie is set by the server
 * action via @supabase/ssr (`HttpOnly`/`Secure`/`SameSite`), so credentials
 * never touch client JS. Auth failures come back as `?error=` in the URL.
 *
 * The instance logo is a public setting, so it can be shown before signing in.
 */
export const instant = false;

export default async function LoginPage() {
  const { settingsDeps } = await getInfra();
  const settings = await readPublicSettings(settingsDeps);
  const logoUrl = typeof settings["instance.logo_url"] === "string" ? settings["instance.logo_url"] : null;

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <LoginForm logoUrl={logoUrl} />
      </Suspense>
    </div>
  );
}
