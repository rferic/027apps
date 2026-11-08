"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { FormActions, FormAlert, FormField } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { copyText } from "@/lib/clipboard";
import { createInvitation, type CreateInvitationInput } from "@/lib/invitation-mutations";
import type { MutationFailure } from "@/lib/mutation-result";
import { invitationConflictError } from "@/lib/panel-errors";
import type { ModuleChoice } from "@/lib/panel-categories";
import { useCreateForm } from "@/lib/use-create-form";

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const secondaryLinkClass =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-muted px-2.5 text-xs font-semibold text-foreground hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const cancelClass =
  "inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
  copyFailed = false,
  onCopy,
  messages,
}: {
  token: string;
  copied: boolean;
  copyFailed?: boolean;
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
      {copyFailed && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {t("Select the text and copy it manually.", messages)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t(
          "The invitee opens the invitation link in the browser or redeems the token from the mobile app to join the instance.",
          messages,
        )}
      </p>
    </div>
  );
}

/**
 * Success state. Once the token exists a second creation would overwrite the
 * only copy of it (the Core returns the plaintext once), so "Create another"
 * asks first while the token has not been copied. "Done" goes back to the list.
 */
export function InvitationCreatedPanel({
  token,
  copied,
  copyFailed = false,
  confirmingAnother = false,
  onCopy,
  onCreateAnother,
  onConfirmAnother,
  onCancelAnother,
  messages,
}: {
  token: string | null;
  copied: boolean;
  copyFailed?: boolean;
  confirmingAnother?: boolean;
  onCopy: () => void;
  onCreateAnother: () => void;
  onConfirmAnother: () => void;
  onCancelAnother: () => void;
  messages: TranslationMap;
}) {
  return (
    <section role="status" className="flex max-w-xl flex-col gap-3">
      <h2 className="text-sm font-semibold">{t("Invitation created", messages)}</h2>
      {token ? (
        <TokenPanel
          token={token}
          copied={copied}
          copyFailed={copyFailed}
          onCopy={onCopy}
          messages={messages}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("The invitation was created but the API did not return a token.", messages)}
        </p>
      )}
      {confirmingAnother ? (
        <div className="flex flex-col gap-2 rounded-card border border-destructive bg-surface p-3">
          <p role="alert" className="text-xs font-semibold text-destructive">
            {t("The token won't be shown again.", messages)}
          </p>
          <FormActions>
            <Button variant="secondary" className="min-h-11" onClick={onCancelAnother}>
              {t("Cancel", messages)}
            </Button>
            <Button variant="primary" className="min-h-11" onClick={onConfirmAnother}>
              {t("Create another", messages)}
            </Button>
          </FormActions>
        </div>
      ) : (
        <FormActions>
          <Button variant="secondary" className="min-h-11" onClick={onCreateAnother}>
            {t("Create another", messages)}
          </Button>
          <Link href="/invitations" className={secondaryLinkClass}>
            {t("Done", messages)}
          </Link>
        </FormActions>
      )}
    </section>
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
        <Select id="invitation-category" name="user_category_id">
          <option value="">{t("No category", messages)}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        id="invitation-modules"
        label={t("Modules", messages)}
        error={fieldErrors.modules?.[0]}
        errorId="invitation-modules-error"
      >
        <Select
          id="invitation-modules"
          name="modules"
          multiple
          size={Math.max(2, Math.min(6, modules.length))}
          className="h-auto py-1 sm:h-auto"
        >
          {modules.map((module) => (
            <option key={module.key} value={module.key}>
              {module.name} ({module.key})
            </option>
          ))}
        </Select>
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

/**
 * Creation form on its own page. The Core returns the plaintext token only in
 * this response (`createInvitation` contract), so it is kept in component state
 * and shown once: never a URL, a cookie, storage or a log. "Create another"
 * resets the shared flow in place, remounting the fields empty.
 */
export function InvitationCreateForm({
  categories,
  modules,
  optionsUnavailable = false,
  messages,
}: InvitationCreateFormProps) {
  const router = useRouter();
  const createForm = useCreateForm();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    createForm.dispatch({ type: "submit" });
    const result = await createInvitation(buildCreateInput(new FormData(form)));

    if (!result.ok) {
      // A known conflict belongs next to the email field, not in a banner.
      const conflict = invitationConflictError(result, messages);
      createForm.dispatch({
        type: "failed",
        error: conflict ? null : result,
        fieldErrors: conflict ? { email: [conflict] } : (result.details?.fieldErrors ?? {}),
      });
      return;
    }

    createForm.dispatch({ type: "created", result: result.token ?? null });
    router.refresh();
  }

  async function handleCopy() {
    if (!createForm.result) return;
    // The token stays in a selectable <input> if every copy path fails.
    const ok = await copyText(createForm.result);
    createForm.dispatch({ type: "copy", ok });
  }

  if (createForm.phase === "created") {
    return (
      <InvitationCreatedPanel
        token={createForm.result}
        copied={createForm.copied}
        copyFailed={createForm.copyFailed}
        confirmingAnother={createForm.confirmingAnother}
        onCopy={handleCopy}
        onCreateAnother={() => createForm.dispatch({ type: "another-requested" })}
        onConfirmAnother={() => createForm.dispatch({ type: "another-confirmed" })}
        onCancelAnother={() => createForm.dispatch({ type: "another-cancelled" })}
        messages={messages}
      />
    );
  }

  return (
    <form
      key={createForm.formKey}
      onSubmit={handleSubmit}
      className="flex max-w-xl flex-col gap-3"
    >
      <InvitationFields
        categories={categories}
        modules={modules}
        fieldErrors={createForm.fieldErrors}
        messages={messages}
      />

      {optionsUnavailable && (
        <p className="text-xs text-muted-foreground">
          {t("Some category or module options are unavailable right now.", messages)}
        </p>
      )}

      {createForm.error && <InvitationCreateError error={createForm.error} messages={messages} />}

      <FormActions>
        <Link href="/invitations" className={cancelClass}>
          {t("Cancel", messages)}
        </Link>
        <Button
          type="submit"
          variant="primary"
          className="min-h-11"
          disabled={createForm.submitting}
        >
          {createForm.submitting ? t("Creating…", messages) : t("Create invitation", messages)}
        </Button>
      </FormActions>
    </form>
  );
}
