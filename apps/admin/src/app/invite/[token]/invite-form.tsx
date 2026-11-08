"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { FormActions, FormAlert, FormField, inputClass } from "@/components/ui/form";
import { inviteErrorHeading } from "@/lib/invite-errors";
import {
  MAX_PASSWORD,
  MIN_PASSWORD,
  type InviteFieldError,
  type InviteFieldErrors,
} from "@/lib/invite-form";
import { submitInvite } from "@/lib/invite-submit";
import type { MutationFailure } from "@/lib/mutation-result";

function fieldMessage(
  error: InviteFieldError | undefined,
  messages: TranslationMap,
): string | undefined {
  switch (error) {
    case "email_required":
      return t("Enter your email address.", messages);
    case "email_invalid":
      return t("Enter a valid email address.", messages);
    case "password_short":
      return t("Use at least 12 characters.", messages);
    case "password_long":
      return t("Use at most 200 characters.", messages);
    case "password_mismatch":
      return t("Passwords do not match.", messages);
    default:
      return undefined;
  }
}

function fieldProps(
  field: "email" | "password" | "confirmation",
  errors: InviteFieldErrors,
): { "aria-invalid"?: true; "aria-describedby"?: string } {
  return errors[field]
    ? { "aria-invalid": true, "aria-describedby": `invite-${field}-error` }
    : {};
}

/** Translated failure banner; an already used invitation points at login. */
export function InviteFailureAlert({
  failure,
  messages,
}: {
  failure: MutationFailure;
  messages: TranslationMap;
}) {
  return (
    <>
      <FormAlert
        message={inviteErrorHeading(failure, messages)}
        requestId={failure.requestId}
        messages={messages}
      />
      {failure.code === "invitation_used" && (
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Sign in", messages)}
        </Link>
      )}
    </>
  );
}

/**
 * Redemption form. The token is the capability and only ever travels in the
 * request path; it is never rendered, stored or logged. Validation mirrors the
 * Core's schema for UX, but the edge decides.
 */
export function InviteForm({ token, messages }: { token: string; messages: TranslationMap }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<MutationFailure | null>(null);
  const [fieldErrors, setFieldErrors] = useState<InviteFieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const data = new FormData(event.currentTarget);
    setFailure(null);
    setFieldErrors({});
    setSubmitting(true);

    const outcome = await submitInvite(
      {
        token,
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
        confirmation: String(data.get("confirmation") ?? ""),
      },
      { replace: (href) => router.replace(href) },
    );

    if (outcome.kind === "redeemed") return;
    setSubmitting(false);
    if (outcome.kind === "invalid") setFieldErrors(outcome.fieldErrors);
    else setFailure(outcome.failure);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <FormField
        id="invite-email"
        label={t("Email", messages)}
        error={fieldMessage(fieldErrors.email, messages)}
        errorId="invite-email-error"
      >
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          {...fieldProps("email", fieldErrors)}
          className={inputClass}
        />
      </FormField>

      <FormField
        id="invite-password"
        label={t("Password", messages)}
        hint={t("At least 12 characters.", messages)}
        hintId="invite-password-hint"
        error={fieldMessage(fieldErrors.password, messages)}
        errorId="invite-password-error"
      >
        <input
          id="invite-password"
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD}
          maxLength={MAX_PASSWORD}
          autoComplete="new-password"
          {...fieldProps("password", fieldErrors)}
          className={inputClass}
        />
      </FormField>

      <FormField
        id="invite-confirmation"
        label={t("Confirm password", messages)}
        error={fieldMessage(fieldErrors.confirmation, messages)}
        errorId="invite-confirmation-error"
      >
        <input
          id="invite-confirmation"
          name="confirmation"
          type="password"
          required
          minLength={MIN_PASSWORD}
          maxLength={MAX_PASSWORD}
          autoComplete="new-password"
          {...fieldProps("confirmation", fieldErrors)}
          className={inputClass}
        />
      </FormField>

      {failure && <InviteFailureAlert failure={failure} messages={messages} />}

      <FormActions>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Sign in", messages)}
        </Link>
        <Button type="submit" variant="primary" className="min-h-11" disabled={submitting}>
          {submitting
            ? t("Accepting…", messages)
            : failure && !failure.code
              ? t("Try again", messages)
              : t("Accept invitation", messages)}
        </Button>
      </FormActions>
    </form>
  );
}
