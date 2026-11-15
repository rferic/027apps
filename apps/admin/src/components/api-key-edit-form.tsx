"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { ApiKeyExpiryField } from "@/components/api-key-expiry-field";
import { ApiKeyScopeFieldset } from "@/components/api-key-scope-fieldset";
import { Button } from "@/components/ui/button";
import { FormActions, FormAlert, FormField, cancelClass, inputClass } from "@/components/ui/form";
import {
  INITIAL_API_KEY_EDIT_STATE,
  selectAllKeyScopes,
  splitKeyScopes,
  toggleKeyScope,
  type ApiKeyEditState,
} from "@/lib/api-key-edit";
import type { ExpiryChoice } from "@/lib/api-key-expiry";
import { apiKeyOfferedScopes } from "@/lib/api-key-module-scopes";
import type { ApiKeyRow } from "@/lib/panel-keys";
import type { UserModule } from "@/lib/panel-user-modules";
import { useResetOnRouteChange } from "@/lib/use-reset-on-route";

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

/**
 * Stored scopes the form cannot offer: a module permission that is no longer
 * granted to the owner, or a legacy scope outside the Core allowlist. They are
 * read-only chips, and the server action re-injects them so saving never drops
 * them silently.
 */
function UnavailableScopes({
  scopes,
  messages,
}: {
  scopes: readonly string[];
  messages: TranslationMap;
}) {
  if (scopes.length === 0) return null;
  const label = t("Not available", messages);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground">
        {t(
          "These permissions are no longer offered, so they are kept as they are.",
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
  offered,
  modules,
  scopes,
  preserved,
  onChange,
  showEmptyError,
  fieldErrors,
  messages,
}: {
  apiKey: ApiKeyRow;
  offered: readonly string[];
  modules: readonly UserModule[];
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
          onChange(toggleKeyScope(scopes, scope, checked, offered))
        }
        onSelectAll={() => onChange(selectAllKeyScopes(offered))}
        onClearAll={() => onChange([])}
        modules={modules}
        fieldErrors={fieldErrors}
        messages={messages}
      />
      <UnavailableScopes scopes={preserved} messages={messages} />
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
      <Link href={`/panel/keys/${encodeURIComponent(id)}`} className={cancelClass}>
        {t("Cancel", messages)}
      </Link>
      <Button type="submit" variant="primary" className="min-h-11" disabled={pending || blocked}>
        {pending ? t("Saving…", messages) : t("Save changes", messages)}
      </Button>
    </FormActions>
  );
}

/** Scopes the form may offer, plus the stored ones it cannot represent. */
function editOffer(apiKey: ApiKeyRow, modules: readonly UserModule[]) {
  const offered = apiKeyOfferedScopes(apiKey.kind, apiKey.roleCap ?? "", modules);
  const { editable, preserved } = splitKeyScopes(apiKey.scopes, offered);
  return {
    offered,
    editable,
    preserved,
    visibleModules: apiKey.kind === "delegated" ? modules : [],
  };
}

export function ApiKeyEditForm({
  apiKey,
  modules = [],
  action,
  currentLabel,
  messages,
}: {
  apiKey: ApiKeyRow;
  /** Modules granted to the owner; only delegated keys receive them. */
  modules?: readonly UserModule[];
  action: ApiKeyEditAction;
  /** The stored expiry, already formatted with the panel locale and zone. */
  currentLabel: string;
  messages: TranslationMap;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_API_KEY_EDIT_STATE);
  const { offered, editable, preserved, visibleModules } = editOffer(apiKey, modules);
  const formRef = useRef<HTMLFormElement>(null);
  const [scopes, setScopes] = useState<readonly string[]>(editable);
  const [expiry, setExpiry] = useState<ExpiryChoice>(
    apiKey.expiresAt ? { mode: "keep" } : { mode: "never" },
  );
  // Bumped on every re-seed: the expiry field keeps its own amount/unit state,
  // so it must be remounted to start from the stored expiry again.
  const [seed, setSeed] = useState(0);

  // Activity preserves the edited key while the user visits another route: the
  // name, the scopes and the expiry would come back as if they had been saved.
  // Re-seed all three from the value the server sent this time.
  useResetOnRouteChange(apiKey, () => {
    formRef.current?.reset();
    setScopes(editable);
    setExpiry(apiKey.expiresAt ? { mode: "keep" } : { mode: "never" });
    setSeed((current) => current + 1);
  });

  const fieldErrors = state.error?.details?.fieldErrors ?? {};
  // A key with only module permissions is still a valid key: the server
  // re-injects them, so the submit is not blocked by an empty editable set.
  const noScopes = scopes.length === 0 && preserved.length === 0;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex w-full flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <ReadOnlyDetails apiKey={apiKey} messages={messages} />

      <NameField apiKey={apiKey} error={fieldErrors.name?.[0]} messages={messages} />

      <ApiKeyExpiryField
        key={seed}
        currentExpiresAt={apiKey.expiresAt}
        currentLabel={currentLabel}
        value={expiry}
        onChange={setExpiry}
        fieldErrors={fieldErrors}
        messages={messages}
      />

      <p className="text-xs text-muted-foreground">
        {t("A key without an expiry never stops working.", messages)}
      </p>

      <ScopeSelector
        apiKey={apiKey}
        offered={offered}
        modules={visibleModules}
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
