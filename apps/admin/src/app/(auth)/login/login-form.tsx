"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { BrandLogo } from "@/components/brand-logo";
import { inputClass } from "@/components/ui/form";
import { signInAction } from "../actions";
import { SubmitButton } from "../submit-button";

interface LoginFormProps {
  messages?: TranslationMap;
  /** `instance.name`; the product name when the setting is missing. */
  instanceName?: string;
}

/**
 * Login form. Reads the auth failure from `?error=`, the forced-logout reason
 * from `?reason=access_revoked` and the notices from `?notice=` in the URL.
 * Kept in its own component so `useSearchParams()` sits inside a Suspense
 * boundary during prerendering.
 */
export function LoginForm({ messages = {}, instanceName = "027Apps" }: LoginFormProps) {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const notice = searchParams.get("notice");
  const reason = searchParams.get("reason");
  const accessRevoked = notice === "access-revoked" || reason === "access_revoked";

  return (
    <form
      action={signInAction}
      className="flex w-full max-w-md flex-col gap-3 rounded-card border border-border bg-surface p-6"
    >
      <BrandLogo size="lg" className="mx-auto" />
      <p className="text-center text-xs text-muted-foreground">{instanceName}</p>
      <h1 className="text-lg font-semibold">{t("Welcome back", messages)}</h1>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("Email", messages)}</span>
        <input
          type="email"
          name="email"
          placeholder="admin@example.com"
          required
          autoComplete="email"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("Password", messages)}</span>
        <input
          type="password"
          name="password"
          placeholder={t("Your password", messages)}
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>

      {notice === "password-reset" && (
        <p className="text-xs text-muted-foreground">
          {t("Your password has been changed. Sign in with the new one.", messages)}
        </p>
      )}
      {notice === "session-expired" && (
        <p className="text-xs text-muted-foreground">
          {t("Your session has ended. Sign in again.", messages)}
        </p>
      )}
      {accessRevoked && (
        <p className="text-xs text-destructive">
          {t("Your access has been revoked. Ask an administrator.", messages)}
        </p>
      )}
      {notice === "invitation-redeemed" && (
        <p className="text-xs text-muted-foreground">
          {t(
            "Invitation accepted. Sign in with your email and password. If you already had an account, use your existing password.",
            messages,
          )}
        </p>
      )}
      {error === "invalid_credentials" && (
        <p className="text-xs text-destructive">{t("Wrong email or password", messages)}</p>
      )}

      <SubmitButton label={t("Sign in", messages)} pendingLabel={t("Signing in…", messages)} />
      <Link
        href="/forgot-password"
        className="text-center text-xs font-semibold text-accent hover:underline"
      >
        {t("Forgot your password?", messages)}
      </Link>
    </form>
  );
}
