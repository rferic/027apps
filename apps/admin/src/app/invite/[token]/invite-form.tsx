"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { FormActions, FormAlert, FormField, cancelClass, inputClass } from "@/components/ui/form";
import { inviteErrorHeading } from "@/lib/invite-errors";
import {
  MAX_PASSWORD,
  MIN_PASSWORD,
  type InviteFieldError,
  type InviteFieldErrors,
} from "@/lib/invite-form";
import { submitInvite } from "@/lib/invite-submit";
import type { MutationFailure } from "@/lib/mutation-result";
import { submitOnce } from "@/lib/submit-guard";
import { submitInvitation } from "./actions";
import { InviteDetails, type InvitePublicView } from "./invite-details";

function fieldMessage(
  error: InviteFieldError | undefined,
  messages: TranslationMap,
): string | undefined {
  switch (error) {
    case "password_required":
      return t("Enter your password.", messages);
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

/**
 * `aria-describedby` must list every description in DOM order: the hint first
 * (`FormField` renders it before the error), then the field error. Without the
 * hint, a screen reader never announces "At least 12 characters.".
 */
export function fieldProps(
  field: "password" | "confirmation",
  errors: InviteFieldErrors,
  hintId?: string,
): { "aria-invalid"?: true; "aria-describedby"?: string } {
  const ids = [hintId, errors[field] ? `invite-${field}-error` : undefined].filter(
    (id): id is string => id !== undefined,
  );
  return {
    ...(errors[field] ? { "aria-invalid": true as const } : {}),
    ...(ids.length > 0 ? { "aria-describedby": ids.join(" ") } : {}),
  };
}

/** Translated failure banner; used/expired point at login or a new invitation. */
export function InviteFailureAlert({
  failure,
  messages,
}: {
  failure: MutationFailure;
  messages: TranslationMap;
}) {
  const forgot = failure.code === "wrong_credentials";
  return (
    <>
      <FormAlert
        message={inviteErrorHeading(failure, messages)}
        requestId={failure.requestId}
        messages={messages}
      />
      {forgot && (
        <Link href="/forgot-password" className={cancelClass}>
          {t("Forgot your password?", messages)}
        </Link>
      )}
      {failure.code === "invitation_used" && (
        <Link href="/login" className={cancelClass}>
          {t("Sign in", messages)}
        </Link>
      )}
    </>
  );
}

/**
 * Redemption form. The token is the capability and only ever travels in the
 * request path; it is never rendered, stored or logged. The email comes from
 * the invitation card, never from an editable input.
 */
export function InviteForm({
  token,
  view,
  messages,
}: {
  token: string;
  view: InvitePublicView;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<MutationFailure | null>(null);
  const [fieldErrors, setFieldErrors] = useState<InviteFieldErrors>({});
  const existing = view.account_exists;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const data = new FormData(event.currentTarget);
    setFailure(null);
    setFieldErrors({});
    setSubmitting(true);

    const outcome = await submitOnce(inFlight, () =>
      submitInvite(
        {
          token,
          password: String(data.get("password") ?? ""),
          confirmation: String(data.get("confirmation") ?? ""),
          accountExists: existing,
        },
        { submit: submitInvitation },
      ),
    );

    if (outcome?.kind === "redeemed") {
      const href = outcome.signInFailed
        ? "/welcome?notice=signin_failed"
        : outcome.role === "user"
          ? "/welcome"
          : "/panel";
      router.replace(href);
      return;
    }
    setSubmitting(false);
    if (outcome?.kind === "invalid") setFieldErrors(outcome.fieldErrors);
    else if (outcome) setFailure(outcome.failure);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <InviteDetails view={view} messages={messages} />

      {existing ? (
        <>
          <FormField
            id="invite-password"
            label={t("Current password", messages)}
            hint={t(
              "The one you already use on this instance. It does not change when you accept.",
              messages,
            )}
            hintId="invite-password-hint"
            error={fieldMessage(fieldErrors.password, messages)}
            errorId="invite-password-error"
          >
            <input
              id="invite-password"
              name="password"
              type="password"
              required
              maxLength={MAX_PASSWORD}
              autoComplete="current-password"
              {...fieldProps("password", fieldErrors, "invite-password-hint")}
              className={inputClass}
            />
          </FormField>
          <Link href="/forgot-password" className={cancelClass}>
            {t("Forgot your password?", messages)}
          </Link>
        </>
      ) : (
        <>
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
              {...fieldProps("password", fieldErrors, "invite-password-hint")}
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
        </>
      )}

      {failure && <InviteFailureAlert failure={failure} messages={messages} />}

      <FormActions>
        <Link href="/login" className={cancelClass}>
          {t("Sign in", messages)}
        </Link>
        <Button type="submit" variant="primary" className="min-h-11" disabled={submitting}>
          {submitting
            ? t("Accepting…", messages)
            : failure && !failure.code
              ? t("Try again", messages)
              : existing
                ? t("Sign in and accept", messages)
                : t("Accept invitation", messages)}
        </Button>
      </FormActions>

      {!existing && (
        <p className="text-xs text-muted-foreground">
          {t("Already have an account?", messages)}{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            {t("Sign in", messages)}
          </Link>
        </p>
      )}
    </form>
  );
}
