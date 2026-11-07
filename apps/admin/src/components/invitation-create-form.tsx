"use client";

import { useRef, useState, type FormEvent, type RefObject, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormActions, FormAlert, FormField } from "@/components/ui/form";
import {
  createInvitation,
  type CreateInvitationInput,
} from "@/lib/invitation-mutations";
import type { MutationFailure } from "@/lib/mutation-result";
import type { ModuleChoice } from "@/lib/panel-categories";

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function fieldState(
  field: string,
  errors: string[] | undefined,
): { "aria-invalid"?: true; "aria-describedby"?: string } {
  const message = errors?.[0];
  return {
    "aria-invalid": message ? true : undefined,
    ...(message ? { "aria-describedby": `invitation-${field}-error` } : {}),
  };
}

function buildCreateInput(data: FormData): CreateInvitationInput {
  const categoryId = String(data.get("user_category_id") ?? "");
  const modules = data
    .getAll("modules")
    .map((value) => String(value))
    .filter((value) => value.length > 0);
  const days = Number(String(data.get("expires_in_days") ?? ""));
  const input: CreateInvitationInput = {
    email: String(data.get("email") ?? "").trim(),
    name: String(data.get("name") ?? "").trim(),
  };
  if (categoryId) input.user_category_id = categoryId;
  if (modules.length > 0) input.modules = modules;
  if (Number.isInteger(days)) input.expires_in_days = days;
  return input;
}

function InvitationCreateError({
  error,
  messages,
}: {
  error: MutationFailure;
  messages: TranslationMap;
}) {
  return (
    <FormAlert
      message={t("We couldn't create the invitation.", messages)}
      code={error.code}
      details={error.details?.formErrors}
      requestId={error.requestId}
      messages={messages}
    />
  );
}

function TokenPanel({
  token,
  copied,
  onCopy,
  messages,
}: {
  token: string;
  copied: boolean;
  onCopy: () => void;
  messages: TranslationMap;
}) {
  return (
    <div
      role="status"
      className="mt-3 flex flex-col gap-2 rounded-card border border-border bg-muted p-3"
    >
      <p className="text-xs font-semibold">
        {t("Copy this token now. It will not be shown again.", messages)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={token}
          aria-label={t("Invitation token", messages)}
          className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-background px-2.5 font-mono text-xs text-foreground"
        />
        <Button variant="secondary" className="min-h-11" onClick={onCopy}>
          {copied ? t("Copied.", messages) : t("Copy token", messages)}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("The invitee redeems this token from the mobile app to join the instance.", messages)}
      </p>
    </div>
  );
}

function InvitationFields({
  categories,
  modules,
  fieldErrors,
  messages,
}: {
  categories: { id: string; name: string }[];
  modules: ModuleChoice[];
  fieldErrors: Record<string, string[]>;
  messages: TranslationMap;
}) {
  return (
    <>
      <FormField
        id="invitation-email"
        label={t("Email", messages)}
        error={fieldErrors.email?.[0]}
        errorId="invitation-email-error"
      >
        <input
          id="invitation-email"
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="off"
          {...fieldState("email", fieldErrors.email)}
          className={inputClass}
        />
      </FormField>

      <FormField
        id="invitation-name"
        label={t("Name", messages)}
        error={fieldErrors.name?.[0]}
        errorId="invitation-name-error"
      >
        <input
          id="invitation-name"
          name="name"
          type="text"
          required
          maxLength={80}
          autoComplete="off"
          {...fieldState("name", fieldErrors.name)}
          className={inputClass}
        />
      </FormField>

      <FormField
        id="invitation-category"
        label={t("Category", messages)}
        error={fieldErrors.user_category_id?.[0]}
        errorId="invitation-category-error"
      >
        <select id="invitation-category" name="user_category_id" className={inputClass}>
          <option value="">{t("No category", messages)}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        id="invitation-modules"
        label={t("Modules", messages)}
        error={fieldErrors.modules?.[0]}
        errorId="invitation-modules-error"
      >
        <select
          id="invitation-modules"
          name="modules"
          multiple
          size={Math.max(2, Math.min(6, modules.length))}
          className={`${inputClass} py-1`}
        >
          {modules.map((module) => (
            <option key={module.key} value={module.key}>
              {module.name} ({module.key})
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        id="invitation-days"
        label={t("Expires in days", messages)}
        error={fieldErrors.expires_in_days?.[0]}
        errorId="invitation-days-error"
      >
        <input
          id="invitation-days"
          name="expires_in_days"
          type="number"
          min={1}
          max={365}
          defaultValue={7}
          {...fieldState("days", fieldErrors.expires_in_days)}
          className={inputClass}
        />
      </FormField>
    </>
  );
}

interface InvitationCreateFormProps {
  categories: { id: string; name: string }[];
  modules: ModuleChoice[];
  /** The category or module reads failed: creation still works without them. */
  optionsUnavailable?: boolean;
  messages: TranslationMap;
}

interface InvitationCreateDialogProps extends InvitationCreateFormProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  creating: boolean;
  created: boolean;
  token: string | null;
  copied: boolean;
  error: MutationFailure | null;
  fieldErrors: Record<string, string[]>;
  onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void;
  /** Closes the dialog; the `onClose` event then clears the state. */
  onDismiss: () => void;
  /** Fired on `close`, including Escape, so the token never survives. */
  onClosed: () => void;
  onCopy: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * The dialog body. Once the token exists the form is not rendered: a second
 * creation in the same dialog would overwrite the only copy of the first token
 * (the Core returns the plaintext token once), so the only way out is "Done".
 */
export function InvitationCreateDialog({
  dialogRef,
  categories,
  modules,
  optionsUnavailable = false,
  creating,
  created,
  token,
  copied,
  error,
  fieldErrors,
  onCancel,
  onDismiss,
  onClosed,
  onCopy,
  onSubmit,
  messages,
}: InvitationCreateDialogProps) {
  return (
    <Dialog
      labelledBy="invitation-create-title"
      ref={dialogRef}
      onCancel={onCancel}
      onClose={onClosed}
      onBackdropClick={creating ? undefined : onDismiss}
    >
      <h2 id="invitation-create-title" className="text-sm font-semibold">
        {created ? t("Invitation created", messages) : t("New invitation", messages)}
      </h2>

      {token ? (
        <>
          <TokenPanel token={token} copied={copied} onCopy={onCopy} messages={messages} />
          <FormActions>
            <Button variant="secondary" className="min-h-11" onClick={onDismiss}>
              {t("Done", messages)}
            </Button>
          </FormActions>
        </>
      ) : (
        <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3">
          {created && (
            <p role="status" className="text-xs text-muted-foreground">
              {t("The invitation was created but the API did not return a token.", messages)}
            </p>
          )}

          <InvitationFields
            categories={categories}
            modules={modules}
            fieldErrors={fieldErrors}
            messages={messages}
          />

          {optionsUnavailable && (
            <p className="text-xs text-muted-foreground">
              {t("Some category or module options are unavailable right now.", messages)}
            </p>
          )}

          {error && <InvitationCreateError error={error} messages={messages} />}

          <FormActions>
            <Button
              variant="secondary"
              className="min-h-11"
              onClick={onDismiss}
              disabled={creating}
            >
              {created ? t("Done", messages) : t("Cancel", messages)}
            </Button>
            <Button type="submit" variant="primary" className="min-h-11" disabled={creating}>
              {creating ? t("Creating…", messages) : t("Create invitation", messages)}
            </Button>
          </FormActions>
        </form>
      )}
    </Dialog>
  );
}

/**
 * Creation form. The Core returns the plaintext token only in this response
 * (`createInvitation` contract), so it is kept in component state and cleared
 * when the dialog closes: never a URL, a cookie, storage or a log.
 */
export function InvitationCreateForm({
  categories,
  modules,
  optionsUnavailable = false,
  messages,
}: InvitationCreateFormProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<MutationFailure | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [token, setToken] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState(false);

  function resetState() {
    setError(null);
    setFieldErrors({});
    setToken(null);
    setCreated(false);
    setCopied(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setCreating(true);
    setError(null);
    setFieldErrors({});
    const result = await createInvitation(buildCreateInput(new FormData(form)));
    setCreating(false);

    if (!result.ok) {
      setFieldErrors(result.details?.fieldErrors ?? {});
      setError(result);
      return;
    }

    form.reset();
    setToken(result.token ?? null);
    setCreated(true);
    setCopied(false);
    router.refresh();
  }

  async function handleCopy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      // The input stays selectable when the clipboard API is unavailable.
      setCopied(false);
    }
  }

  function closeDialog() {
    dialogRef.current?.close();
    resetState();
  }

  return (
    <>
      <Button
        variant="primary"
        className="min-h-11"
        onClick={() => {
          resetState();
          dialogRef.current?.showModal();
        }}
      >
        {t("Create invitation", messages)}
      </Button>

      <InvitationCreateDialog
        dialogRef={dialogRef}
        categories={categories}
        modules={modules}
        optionsUnavailable={optionsUnavailable}
        creating={creating}
        created={created}
        token={token}
        copied={copied}
        error={error}
        fieldErrors={fieldErrors}
        onCancel={(event) => {
          // Escape must not dismiss the dialog while the request is in flight.
          if (creating) event.preventDefault();
        }}
        onDismiss={closeDialog}
        onClosed={resetState}
        onCopy={handleCopy}
        onSubmit={handleSubmit}
        messages={messages}
      />
    </>
  );
}
