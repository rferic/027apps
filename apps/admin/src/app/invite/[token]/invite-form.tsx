"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { FormActions, FormAlert, FormField, cancelClass, inputClass } from "@/components/ui/form";
import { SignInIcon } from "@/components/ui/sign-in-icon";
import { inviteErrorHeading } from "@/lib/invite-errors";
import {
  MAX_NAME,
  MAX_PASSWORD,
  MIN_PASSWORD,
  type InviteField,
  type InviteFieldError,
  type InviteFieldErrors,
} from "@/lib/invite-form";
import { submitInvite } from "@/lib/invite-submit";
import type { MutationFailure } from "@/lib/mutation-result";
import { submitOnce } from "@/lib/submit-guard";
import { submitInvitation } from "./actions";
import type { InvitePublicView } from "./invite-details";

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
    case "name_required":
    case "name_long":
      return t("Use a name between 1 and 80 characters.", messages);
    case "email_required":
      return t("Enter your email address.", messages);
    case "email_invalid":
      return t("Enter a valid email address.", messages);
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
  field: InviteField,
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
 * Where the browser lands after a redemption: a plain member has no panel
 * pages, so it is `/welcome` with the notice that explains what just happened.
 */
export function redeemedHref(outcome: {
  role: "super_admin" | "admin" | "user";
  signInFailed?: boolean;
  existingAccount?: boolean;
}): string {
  const notice = outcome.signInFailed
    ? "signin_failed"
    : outcome.existingAccount
      ? "existing_account"
      : null;
  if (notice) return `/welcome?notice=${notice}`;
  return outcome.role === "user" ? "/welcome" : "/panel";
}

/** The label of the submit button for the current state of the form. */
function submitLabel(
  existing: boolean,
  submitting: boolean,
  failure: MutationFailure | null,
  messages: TranslationMap,
): string {
  if (submitting) return t("Accepting…", messages);
  if (failure && !failure.code) return t("Try again", messages);
  return existing ? t("Sign in and accept", messages) : t("Accept invitation", messages);
}

/** The name and email an anonymous invitation collects at redemption. */
function IdentityFields({
  errors,
  messages,
}: {
  errors: InviteFieldErrors;
  messages: TranslationMap;
}) {
  return (
    <>
      <FormField
        id="invite-name"
        label={t("Name", messages)}
        error={fieldMessage(errors.name, messages)}
        errorId="invite-name-error"
      >
        <input
          id="invite-name"
          name="name"
          type="text"
          required
          maxLength={MAX_NAME}
          autoComplete="name"
          {...fieldProps("name", errors)}
          className={inputClass}
        />
      </FormField>

      <FormField
        id="invite-email"
        label={t("Email", messages)}
        hint={t("Enter your email address.", messages)}
        hintId="invite-email-hint"
        error={fieldMessage(errors.email, messages)}
        errorId="invite-email-error"
      >
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          {...fieldProps("email", errors, "invite-email-hint")}
          className={inputClass}
        />
      </FormField>
    </>
  );
}

/** Existing account: only its current password, with a way out if forgotten. */
function CurrentPasswordFields({
  errors,
  messages,
}: {
  errors: InviteFieldErrors;
  messages: TranslationMap;
}) {
  return (
    <>
      <FormField
        id="invite-password"
        label={t("Current password", messages)}
        hint={t(
          "The one you already use on this instance. It does not change when you accept.",
          messages,
        )}
        hintId="invite-password-hint"
        error={fieldMessage(errors.password, messages)}
        errorId="invite-password-error"
      >
        <input
          id="invite-password"
          name="password"
          type="password"
          required
          maxLength={MAX_PASSWORD}
          autoComplete="current-password"
          {...fieldProps("password", errors, "invite-password-hint")}
          className={inputClass}
        />
      </FormField>
      <Link href="/forgot-password" className={cancelClass}>
        {t("Forgot your password?", messages)}
      </Link>
    </>
  );
}

/** New account: the password and its confirmation. */
function NewPasswordFields({
  requiresIdentity,
  errors,
  messages,
}: {
  requiresIdentity: boolean;
  errors: InviteFieldErrors;
  messages: TranslationMap;
}) {
  return (
    <>
      <FormField
        id="invite-password"
        label={t("Password", messages)}
        hint={t("At least 12 characters.", messages)}
        hintId="invite-password-hint"
        error={fieldMessage(errors.password, messages)}
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
          {...fieldProps("password", errors, "invite-password-hint")}
          className={inputClass}
        />
      </FormField>

      <FormField
        id="invite-confirmation"
        label={t("Confirm password", messages)}
        error={fieldMessage(errors.confirmation, messages)}
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
          {...fieldProps("confirmation", errors)}
          className={inputClass}
        />
      </FormField>

      {requiresIdentity && (
        <p className="text-xs text-muted-foreground">
          {t("If you already have an account, use your current password.", messages)}
        </p>
      )}
    </>
  );
}

/**
 * Redemption form. The token is the capability and only ever travels in the
 * request path; it is never rendered, stored or logged. The email comes from
 * the invitation card, except on an anonymous one, where the invitee types it.
 */
type SubmitOutcome = Awaited<ReturnType<typeof submitInvite>>;

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
  // An anonymous invitation never reveals whether the email has an account
  // (D11), so the preview always says `false`. The redeem is where it shows:
  // the action answers `existing_account` and the form switches to asking for
  // the current password, without reloading.
  const [detectedExisting, setDetectedExisting] = useState(false);
  const existing = view.account_exists || detectedExisting;

  /** The action, with the transport failure the form must survive. */
  async function askServer(data: FormData): Promise<SubmitOutcome | null> {
    try {
      const outcome = await submitOnce(inFlight, () =>
        submitInvite(
          {
            token,
            password: String(data.get("password") ?? ""),
            confirmation: String(data.get("confirmation") ?? ""),
            name: String(data.get("name") ?? ""),
            email: String(data.get("email") ?? ""),
            accountExists: existing,
            requiresIdentity: view.requires_identity,
          },
          { submit: submitInvitation },
        ),
      );
      return outcome ?? null;
    } catch {
      // The action never reached the server: the generic retry replaces the
      // stuck "Accepting…".
      return null;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setFailure(null);
    setFieldErrors({});
    setSubmitting(true);

    const outcome = await askServer(new FormData(event.currentTarget));
    if (outcome === null) {
      setSubmitting(false);
      setFailure({ ok: false });
      return;
    }
    if (outcome.kind === "redeemed") {
      router.replace(redeemedHref(outcome));
      return;
    }
    setSubmitting(false);
    if (outcome.kind === "invalid") {
      setFieldErrors(outcome.fieldErrors);
      return;
    }
    setDetectedExisting(outcome.failure.code === "existing_account");
    setFailure(outcome.failure);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      {view.requires_identity && <IdentityFields errors={fieldErrors} messages={messages} />}

      {existing ? (
        <CurrentPasswordFields errors={fieldErrors} messages={messages} />
      ) : (
        <NewPasswordFields
          requiresIdentity={view.requires_identity}
          errors={fieldErrors}
          messages={messages}
        />
      )}

      {failure && <InviteFailureAlert failure={failure} messages={messages} />}

      <FormActions>
        {existing && (
          <Link href="/login" className={`${cancelClass} gap-1`}>
            <SignInIcon />
            {t("Sign in", messages)}
          </Link>
        )}
        <Button type="submit" variant="primary" className="min-h-11" disabled={submitting}>
          {submitLabel(existing, submitting, failure, messages)}
        </Button>
      </FormActions>

      {!existing && (
        <p className="text-xs text-muted-foreground">
          {t("Already have an account?", messages)}{" "}
          <Link
            href="/login"
            className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
          >
            <SignInIcon />
            {t("Sign in", messages)}
          </Link>
        </p>
      )}
    </form>
  );
}
