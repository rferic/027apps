"use client";

import { useEffect, useReducer, type FormEvent } from "react";
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

/**
 * Creation flow state. It is a reducer so the "create another" transitions (ask
 * first, or reset straight away once the token was copied) are testable without
 * a DOM, and so `formKey` can force a clean remount of the uncontrolled fields.
 */
export interface InvitationCreateState {
  submitting: boolean;
  phase: "form" | "created";
  token: string | null;
  copied: boolean;
  copyFailed: boolean;
  confirmingAnother: boolean;
  error: MutationFailure | null;
  fieldErrors: Record<string, string[]>;
  /** `key` of the form: bumping it remounts the fields empty. */
  formKey: number;
}

export const INITIAL_INVITATION_CREATE_STATE: InvitationCreateState = {
  submitting: false,
  phase: "form",
  token: null,
  copied: false,
  copyFailed: false,
  confirmingAnother: false,
  error: null,
  fieldErrors: {},
  formKey: 0,
};

export type InvitationCreateAction =
  | { type: "submit" }
  | { type: "failed"; error: MutationFailure | null; fieldErrors: Record<string, string[]> }
  | { type: "created"; token: string | null }
  | { type: "copy-succeeded" }
  | { type: "copy-failed" }
  | { type: "another-requested" }
  | { type: "another-cancelled" }
  | { type: "another-confirmed" }
  | { type: "reset" };

/** Back to an empty form on the same page, without the previous token or errors. */
function blankState(state: InvitationCreateState): InvitationCreateState {
  return { ...INITIAL_INVITATION_CREATE_STATE, formKey: state.formKey + 1 };
}

type ResetAction = Extract<
  InvitationCreateAction,
  { type: "another-requested" | "another-cancelled" | "another-confirmed" | "reset" }
>;

/** Leaving the created step: ask while the token is uncopied, reset otherwise. */
function resetStep(state: InvitationCreateState, action: ResetAction): InvitationCreateState {
  if (action.type === "another-cancelled") return { ...state, confirmingAnother: false };
  if (action.type === "another-requested" && state.token && !state.copied) {
    return { ...state, confirmingAnother: true };
  }
  return blankState(state);
}

export function invitationCreateReducer(
  state: InvitationCreateState,
  action: InvitationCreateAction,
): InvitationCreateState {
  switch (action.type) {
    case "submit":
      return { ...state, submitting: true, error: null, fieldErrors: {} };
    case "failed":
      return {
        ...state,
        submitting: false,
        error: action.error,
        fieldErrors: action.fieldErrors,
      };
    case "created":
      return {
        ...state,
        submitting: false,
        phase: "created",
        token: action.token,
        copied: false,
        copyFailed: false,
        confirmingAnother: false,
        error: null,
        fieldErrors: {},
        formKey: state.formKey + 1,
      };
    case "copy-succeeded":
    case "copy-failed":
      // One flag is the inverse of the other: kept together so the reducer
      // stays a flat table.
      return {
        ...state,
        copied: action.type === "copy-succeeded",
        copyFailed: action.type === "copy-failed",
      };
    default:
      return resetStep(state, action);
  }
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
        {t("The invitee redeems this token from the mobile app to join the instance.", messages)}
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
 * resets the flow in place, remounting the fields empty.
 */
export function InvitationCreateForm({
  categories,
  modules,
  optionsUnavailable = false,
  messages,
}: InvitationCreateFormProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    invitationCreateReducer,
    INITIAL_INVITATION_CREATE_STATE,
  );

  // A client-cached instance must not reopen on the previous token or errors.
  useEffect(() => {
    dispatch({ type: "reset" });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    dispatch({ type: "submit" });
    const result = await createInvitation(buildCreateInput(new FormData(form)));

    if (!result.ok) {
      // A known conflict belongs next to the email field, not in a banner.
      const conflict = invitationConflictError(result, messages);
      dispatch({
        type: "failed",
        error: conflict ? null : result,
        fieldErrors: conflict ? { email: [conflict] } : (result.details?.fieldErrors ?? {}),
      });
      return;
    }

    dispatch({ type: "created", token: result.token ?? null });
    router.refresh();
  }

  async function handleCopy() {
    if (!state.token) return;
    // The token stays in a selectable <input> if every copy path fails.
    const ok = await copyText(state.token);
    dispatch({ type: ok ? "copy-succeeded" : "copy-failed" });
  }

  if (state.phase === "created") {
    return (
      <InvitationCreatedPanel
        token={state.token}
        copied={state.copied}
        copyFailed={state.copyFailed}
        confirmingAnother={state.confirmingAnother}
        onCopy={handleCopy}
        onCreateAnother={() => dispatch({ type: "another-requested" })}
        onConfirmAnother={() => dispatch({ type: "another-confirmed" })}
        onCancelAnother={() => dispatch({ type: "another-cancelled" })}
        messages={messages}
      />
    );
  }

  return (
    <form key={state.formKey} onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3">
      <InvitationFields
        categories={categories}
        modules={modules}
        fieldErrors={state.fieldErrors}
        messages={messages}
      />

      {optionsUnavailable && (
        <p className="text-xs text-muted-foreground">
          {t("Some category or module options are unavailable right now.", messages)}
        </p>
      )}

      {state.error && <InvitationCreateError error={state.error} messages={messages} />}

      <FormActions>
        <Link href="/invitations" className={cancelClass}>
          {t("Cancel", messages)}
        </Link>
        <Button type="submit" variant="primary" className="min-h-11" disabled={state.submitting}>
          {state.submitting ? t("Creating…", messages) : t("Create invitation", messages)}
        </Button>
      </FormActions>
    </form>
  );
}
