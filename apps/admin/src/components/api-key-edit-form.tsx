"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { ApiKeyScopeFieldset } from "@/components/api-key-scope-fieldset";
import { Button } from "@/components/ui/button";
import { FormActions, FormAlert, FormField } from "@/components/ui/form";
import {
  INITIAL_API_KEY_EDIT_STATE,
  selectAllKeyScopes,
  splitKeyScopes,
  toDateTimeLocal,
  toggleKeyScope,
  type ApiKeyEditState,
} from "@/lib/api-key-edit";
import { allowedApiKeyScopes } from "@/lib/api-key-scopes";
import type { ApiKeyRow } from "@/lib/panel-keys";

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const cancelClass =
  "inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Submit handler bound to the key id by the page (server action). */
export type ApiKeyEditAction = (
  state: ApiKeyEditState,
  formData: FormData,
) => Promise<ApiKeyEditState>;

function kindLabel(kind: ApiKeyRow["kind"], messages: TranslationMap): string {
  return kind === "service" ? t("Service", messages) : t("Delegated", messages);
}

function ownerLabel(apiKey: ApiKeyRow, messages: TranslationMap): string {
  return apiKey.kind === "service" ? t("Instance", messages) : apiKey.owner;
}

function roleCapLabel(apiKey: ApiKeyRow, messages: TranslationMap): string | null {
  if (apiKey.kind !== "service" || !apiKey.roleCap) return null;
  return apiKey.roleCap === "super_admin"
    ? t("Super administrator", messages)
    : t("Administrator", messages);
}

/**
 * The API refuses an expiry in the past and cannot clear one, so the rule is
 * explained up front instead of after a failed save.
 */
function expiryHint(apiKey: ApiKeyRow, messages: TranslationMap): string {
  if (!apiKey.expiresAt) return t("Leave empty for a key that never expires.", messages);
  return `${t("An expired key can only be extended.", messages)} ${t("Leave empty to keep the current expiry.", messages)}`;
}

function saveErrorMessage(
  error: NonNullable<ApiKeyEditState["error"]>,
  messages: TranslationMap,
): string {
  return error.details?.code === "revoked"
    ? t("This key is already revoked.", messages)
    : t("We couldn't save the API key.", messages);
}

function ReadOnlyItem({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-[11px]" : "text-xs"}>{children}</dd>
    </div>
  );
}

function ReadOnlyDetails({ apiKey, messages }: { apiKey: ApiKeyRow; messages: TranslationMap }) {
  const cap = roleCapLabel(apiKey, messages);
  return (
    <dl className="grid grid-cols-1 gap-3 rounded-card border border-border bg-muted p-3 sm:grid-cols-2">
      <ReadOnlyItem label={t("Kind", messages)}>{kindLabel(apiKey.kind, messages)}</ReadOnlyItem>
      <ReadOnlyItem label={t("Owner", messages)}>{ownerLabel(apiKey, messages)}</ReadOnlyItem>
      {cap && <ReadOnlyItem label={t("Role cap", messages)}>{cap}</ReadOnlyItem>}
      <ReadOnlyItem label={t("Prefix", messages)} mono>
        {apiKey.prefix}
      </ReadOnlyItem>
    </dl>
  );
}

function NameField({ apiKey, error, messages }: {
  apiKey: ApiKeyRow;
  error?: string;
  messages: TranslationMap;
}) {
  return (
    <FormField
      id="api-key-edit-name"
      label={t("Name", messages)}
      error={error}
      errorId="api-key-edit-name-error"
    >
      <input
        id="api-key-edit-name"
        name="name"
        type="text"
        required
        maxLength={80}
        autoComplete="off"
        defaultValue={apiKey.name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "api-key-edit-name-error" : undefined}
        className={inputClass}
      />
    </FormField>
  );
}

interface ExpiresFieldProps {
  apiKey: ApiKeyRow;
  value: string;
  currentValue: string;
  error?: string;
  onChange: (value: string) => void;
  messages: TranslationMap;
}

function ExpiresField({
  apiKey,
  value,
  currentValue,
  error,
  onChange,
  messages,
}: ExpiresFieldProps) {
  return (
    <>
      <FormField
        id="api-key-edit-expires"
        label={t("Expires", messages)}
        hint={expiryHint(apiKey, messages)}
        error={error}
        errorId="api-key-edit-expires-error"
      >
        <input
          id="api-key-edit-expires"
          name="expires_at"
          type="datetime-local"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      </FormField>
      <input type="hidden" name="current_expires_at" value={currentValue} />
    </>
  );
}

/**
 * Module permissions live outside the Core allowlist: they depend on the
 * modules granted to the owner and are managed from the app, so the panel only
 * shows them as read-only chips and never offers a way to remove them.
 */
function PreservedScopes({
  scopes,
  messages,
}: {
  scopes: readonly string[];
  messages: TranslationMap;
}) {
  if (scopes.length === 0) return null;
  const label = t("Module permissions", messages);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground">
        {t(
          "Module permissions depend on the modules granted to the owner and are managed from the app.",
          messages,
        )}
      </p>
      <ul aria-label={label} className="flex flex-wrap gap-2">
        {scopes.map((scope) => (
          <li
            key={scope}
            className="rounded-control border border-border bg-muted px-2 py-1 font-mono text-[11px]"
          >
            {scope}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScopeSelector({
  apiKey,
  allowed,
  scopes,
  preserved,
  onChange,
  showEmptyError,
  fieldErrors,
  messages,
}: {
  apiKey: ApiKeyRow;
  allowed: readonly string[];
  scopes: readonly string[];
  preserved: readonly string[];
  onChange: (scopes: readonly string[]) => void;
  showEmptyError: boolean;
  fieldErrors: Record<string, string[]>;
  messages: TranslationMap;
}) {
  return (
    <>
      <ApiKeyScopeFieldset
        kind={apiKey.kind}
        roleCap={apiKey.roleCap ?? ""}
        selected={scopes}
        onToggle={(scope, checked) =>
          onChange(toggleKeyScope(scopes, scope, checked, allowed))
        }
        onSelectAll={() => onChange(selectAllKeyScopes(allowed))}
        onClearAll={() => onChange([])}
        fieldErrors={fieldErrors}
        messages={messages}
      />
      <PreservedScopes scopes={preserved} messages={messages} />
      {showEmptyError && (
        <p role="status" className="text-xs font-semibold text-destructive">
          {t("Choose at least one scope.", messages)}
        </p>
      )}
    </>
  );
}

function FormFooter({
  id,
  pending,
  blocked,
  messages,
}: {
  id: string;
  pending: boolean;
  blocked: boolean;
  messages: TranslationMap;
}) {
  return (
    <FormActions>
      <Link href={`/keys/${encodeURIComponent(id)}`} className={cancelClass}>
        {t("Cancel", messages)}
      </Link>
      <Button type="submit" variant="primary" className="min-h-11" disabled={pending || blocked}>
        {pending ? t("Saving…", messages) : t("Save changes", messages)}
      </Button>
    </FormActions>
  );
}

export function ApiKeyEditForm({
  apiKey,
  action,
  messages,
}: {
  apiKey: ApiKeyRow;
  action: ApiKeyEditAction;
  messages: TranslationMap;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_API_KEY_EDIT_STATE);
  const allowed = allowedApiKeyScopes(apiKey.kind, apiKey.roleCap ?? "");
  const { editable, preserved } = splitKeyScopes(apiKey.scopes, allowed);
  const [scopes, setScopes] = useState<readonly string[]>(editable);
  const currentExpiresAt = toDateTimeLocal(apiKey.expiresAt);
  const [expiresAt, setExpiresAt] = useState(currentExpiresAt);

  const fieldErrors = state.error?.details?.fieldErrors ?? {};
  // A key with only module permissions is still a valid key: the server
  // re-injects them, so the submit is not blocked by an empty editable set.
  const noScopes = scopes.length === 0 && preserved.length === 0;

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-3">
      <ReadOnlyDetails apiKey={apiKey} messages={messages} />

      <NameField apiKey={apiKey} error={fieldErrors.name?.[0]} messages={messages} />

      <ExpiresField
        apiKey={apiKey}
        value={expiresAt}
        currentValue={currentExpiresAt}
        error={fieldErrors.expires_at?.[0]}
        onChange={setExpiresAt}
        messages={messages}
      />

      <ScopeSelector
        apiKey={apiKey}
        allowed={allowed}
        scopes={scopes}
        preserved={preserved}
        onChange={setScopes}
        showEmptyError={noScopes}
        fieldErrors={fieldErrors}
        messages={messages}
      />

      <p className="text-xs text-muted-foreground">
        {t("Changes apply from the next request on.", messages)}
      </p>

      {state.error && (
        <FormAlert
          message={saveErrorMessage(state.error, messages)}
          code={state.error.code}
          details={state.error.details?.formErrors}
          requestId={state.error.requestId}
          messages={messages}
        />
      )}

      <FormFooter id={apiKey.id} pending={pending} blocked={noScopes} messages={messages} />
    </form>
  );
}
