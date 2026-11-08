"use client";

import { useReducer, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { FieldError, FormActions, FormAlert, FormField } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { createApiKey, type CreateApiKeyInput } from "@/lib/api-key-mutations";
import { copyText } from "@/lib/clipboard";
import {
  API_KEY_SCOPE_GROUPS,
  allowedApiKeyScopes,
  type ApiKeyScopeRoleCap,
  type ScopeGroupId,
} from "@/lib/api-key-scopes";
import type { MutationFailure } from "@/lib/mutation-result";
import { useCreateForm } from "@/lib/use-create-form";

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const secondaryLinkClass =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-muted px-2.5 text-xs font-semibold text-foreground hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const cancelClass =
  "inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type KeyKind = "service" | "delegated";

/** Empty until the user picks a cap; a service key cannot be created without it. */
export type ApiKeyRoleCap = ApiKeyScopeRoleCap | "";

const SCOPE_GROUP_LABEL: Record<ScopeGroupId, (messages: TranslationMap) => string> = {
  profile: (messages) => t("Profile", messages),
  members: (messages) => t("Members", messages),
  categories: (messages) => t("Categories", messages),
  invitations: (messages) => t("Invitations", messages),
  modules: (messages) => t("Modules", messages),
  devices: (messages) => t("Devices", messages),
  api_keys: (messages) => t("API keys", messages),
  settings: (messages) => t("Settings", messages),
  currencies: (messages) => t("Currencies", messages),
  maintenance: (messages) => t("Maintenance", messages),
};

function scopeGroupLabel(id: ScopeGroupId, messages: TranslationMap): string {
  return SCOPE_GROUP_LABEL[id](messages);
}

function fieldState(field: string, errors: string[] | undefined, hintId?: string) {
  const message = errors?.[0];
  const ids = [hintId, message ? `api-key-${field}-error` : undefined].filter(
    (id): id is string => Boolean(id),
  );
  return {
    "aria-invalid": message ? true : undefined,
    ...(ids.length > 0 ? { "aria-describedby": ids.join(" ") } : {}),
  };
}

/** The kind fields own their state so a new visit remounts them empty. */
export interface ApiKeyFormState {
  kind: KeyKind;
  roleCap: ApiKeyRoleCap;
  scopes: readonly string[];
}

export const INITIAL_API_KEY_FORM_STATE: ApiKeyFormState = {
  kind: "delegated",
  roleCap: "",
  scopes: [],
};

export type ApiKeyFormAction =
  | { type: "kind"; kind: KeyKind }
  | { type: "role-cap"; roleCap: ApiKeyRoleCap }
  | { type: "scope"; scope: string; checked: boolean }
  | { type: "reset" };

function normalizeRoleCap(value: string): ApiKeyRoleCap {
  if (value === "admin" || value === "super_admin") return value;
  return "";
}

function pruneScopes(
  kind: KeyKind,
  roleCap: ApiKeyRoleCap,
  scopes: readonly string[],
): readonly string[] {
  const allowed = new Set(allowedApiKeyScopes(kind, roleCap));
  return scopes.filter((scope) => allowed.has(scope));
}

/**
 * Scopes are always derived from `(kind, roleCap)`: changing either drops any
 * selection the new pair no longer allows, so a stale checkbox can never be
 * submitted and switching back never resurrects it.
 */
export function apiKeyFormReducer(
  state: ApiKeyFormState,
  action: ApiKeyFormAction,
): ApiKeyFormState {
  switch (action.type) {
    case "kind":
      // The cap belongs to the service kind: it must be chosen again.
      return {
        kind: action.kind,
        roleCap: "",
        scopes: pruneScopes(action.kind, "", state.scopes),
      };
    case "role-cap": {
      const roleCap = normalizeRoleCap(action.roleCap);
      return { ...state, roleCap, scopes: pruneScopes(state.kind, roleCap, state.scopes) };
    }
    case "scope": {
      if (!action.checked) {
        return { ...state, scopes: state.scopes.filter((scope) => scope !== action.scope) };
      }
      if (!allowedApiKeyScopes(state.kind, state.roleCap).includes(action.scope)) return state;
      if (state.scopes.includes(action.scope)) return state;
      return { ...state, scopes: [...state.scopes, action.scope] };
    }
    default:
      return INITIAL_API_KEY_FORM_STATE;
  }
}

function buildCreateInput(
  data: FormData,
  kind: KeyKind,
  roleCap: ApiKeyRoleCap,
  selected: readonly string[],
): CreateApiKeyInput {
  const allowed = new Set(allowedApiKeyScopes(kind, roleCap));
  const input: CreateApiKeyInput = {
    kind,
    name: String(data.get("name") ?? "").trim(),
    scopes: selected.filter((scope) => allowed.has(scope)),
  };
  if (kind === "service" && roleCap) input.role_cap = roleCap;
  return input;
}

function CreateErrorAlert({
  error,
  messages,
}: {
  error: MutationFailure;
  messages: TranslationMap;
}) {
  return (
    <FormAlert
      message={t("We couldn't create the API key.", messages)}
      code={error.code}
      details={error.details?.formErrors}
      requestId={error.requestId}
      messages={messages}
    />
  );
}

function SecretPanel({
  secret,
  copied,
  copyFailed = false,
  onCopy,
  messages,
}: {
  secret: string;
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
        {t("Copy this key now. It will not be shown again.", messages)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={secret}
          aria-label={t("API key", messages)}
          className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-background px-2.5 font-mono text-xs text-foreground"
        />
        <Button variant="secondary" className="min-h-11" onClick={onCopy}>
          {copied ? t("Copied.", messages) : t("Copy key", messages)}
        </Button>
      </div>
      {copyFailed && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {t("Select the text and copy it manually.", messages)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t("The key is stored hashed. If you lose it, revoke it and create another.", messages)}
      </p>
    </div>
  );
}

/**
 * Success state. Once the secret exists the form is not rendered: creating a
 * second key on the same page would hide the only copy of the first secret
 * (the Core returns it once). The only way out is "Done".
 */
export function ApiKeyCreatedPanel({
  secret,
  copied,
  copyFailed = false,
  onCopy,
  messages,
}: {
  secret: string | null;
  copied: boolean;
  copyFailed?: boolean;
  onCopy: () => void;
  messages: TranslationMap;
}) {
  return (
    <section role="status" className="flex max-w-xl flex-col gap-3">
      <h2 className="text-sm font-semibold">{t("API key created", messages)}</h2>
      {secret ? (
        <SecretPanel
          secret={secret}
          copied={copied}
          copyFailed={copyFailed}
          onCopy={onCopy}
          messages={messages}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("The key was created but the API did not return the secret.", messages)}
        </p>
      )}
      <FormActions>
        <Link href="/keys" className={secondaryLinkClass}>
          {t("Done", messages)}
        </Link>
      </FormActions>
    </section>
  );
}

export function ApiKeyScopeChoices({
  kind,
  roleCap,
  selected,
  onToggle,
  fieldErrors,
  messages,
}: {
  kind: KeyKind;
  roleCap: ApiKeyRoleCap;
  selected: readonly string[];
  onToggle: (scope: string, checked: boolean) => void;
  fieldErrors: Record<string, string[]>;
  messages: TranslationMap;
}) {
  const allowed = new Set(allowedApiKeyScopes(kind, roleCap));
  const groups = API_KEY_SCOPE_GROUPS.map((group) => ({
    ...group,
    scopes: group.scopes.filter((scope) => allowed.has(scope)),
  })).filter((group) => group.scopes.length > 0);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-semibold">{t("Scopes", messages)}</legend>
      <p className="text-xs text-muted-foreground">
        {t("Scopes are limited by the key kind and role cap.", messages)}
      </p>
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {scopeGroupLabel(group.id, messages)}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {group.scopes.map((scope) => (
              <label key={scope} className="flex min-h-11 items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name="scopes"
                  value={scope}
                  checked={selected.includes(scope)}
                  onChange={(event) => onToggle(scope, event.target.checked)}
                />
                <span className="font-mono text-[11px]">{scope}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <FieldError id="api-key-scopes-error" message={fieldErrors.scopes?.[0]} />
    </fieldset>
  );
}

export function ApiKeyKindFields({
  canCreateService,
  kind,
  roleCap,
  onKindChange,
  onRoleCapChange,
  fieldErrors,
  messages,
}: {
  canCreateService: boolean;
  kind: KeyKind;
  roleCap: ApiKeyRoleCap;
  onKindChange: (kind: KeyKind) => void;
  onRoleCapChange: (roleCap: ApiKeyRoleCap) => void;
  fieldErrors: Record<string, string[]>;
  messages: TranslationMap;
}) {
  return (
    <>
      <FormField
        id="api-key-kind"
        label={t("Kind", messages)}
        hint={
          kind === "service"
            ? t("A service key acts for the instance, capped by the role you choose.", messages)
            : t("A delegated key acts for you and never exceeds your own permissions.", messages)
        }
        hintId="api-key-kind-help"
        error={fieldErrors.kind?.[0]}
        errorId="api-key-kind-error"
      >
        <Select
          id="api-key-kind"
          name="kind"
          value={kind}
          onChange={(event) => onKindChange(event.target.value === "service" ? "service" : "delegated")}
          {...fieldState("kind", fieldErrors.kind, "api-key-kind-help")}
        >
          <option value="delegated">{t("Delegated", messages)}</option>
          {canCreateService && <option value="service">{t("Service", messages)}</option>}
        </Select>
      </FormField>

      {kind === "service" && canCreateService && (
        <FormField
          id="api-key-role-cap"
          label={t("Role cap", messages)}
          error={fieldErrors.role_cap?.[0]}
          errorId="api-key-role-cap-error"
        >
          <Select
            id="api-key-role-cap"
            name="role_cap"
            required
            value={roleCap}
            onChange={(event) => onRoleCapChange(normalizeRoleCap(event.target.value))}
            {...fieldState("role_cap", fieldErrors.role_cap)}
          >
            <option value="">{t("Choose a role cap.", messages)}</option>
            <option value="admin">{t("Administrator", messages)}</option>
            <option value="super_admin">{t("Super administrator", messages)}</option>
          </Select>
        </FormField>
      )}
    </>
  );
}

interface ApiKeyCreateFormBodyProps {
  canCreateService: boolean;
  submitting: boolean;
  error: MutationFailure | null;
  fieldErrors: Record<string, string[]>;
  onSubmit: (input: CreateApiKeyInput) => void;
  onInvalid: (fieldErrors: Record<string, string[]>) => void;
  onClearFieldError: (field: string) => void;
  messages: TranslationMap;
}

function ApiKeyCreateFormBody({
  canCreateService,
  submitting,
  error,
  fieldErrors,
  onSubmit,
  onInvalid,
  onClearFieldError,
  messages,
}: ApiKeyCreateFormBodyProps) {
  const [state, dispatch] = useReducer(apiKeyFormReducer, INITIAL_API_KEY_FORM_STATE);

  function handleKindChange(kind: KeyKind) {
    dispatch({ type: "kind", kind });
    onClearFieldError("role_cap");
  }

  function handleRoleCapChange(roleCap: ApiKeyRoleCap) {
    dispatch({ type: "role-cap", roleCap });
    onClearFieldError("role_cap");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === "service" && !state.roleCap) {
      onInvalid({ role_cap: [t("Choose a role cap.", messages)] });
      return;
    }
    onSubmit(buildCreateInput(new FormData(event.currentTarget), state.kind, state.roleCap, state.scopes));
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3">
      <FormField
        id="api-key-name"
        label={t("Name", messages)}
        error={fieldErrors.name?.[0]}
        errorId="api-key-name-error"
      >
        <input
          id="api-key-name"
          name="name"
          type="text"
          required
          maxLength={80}
          autoComplete="off"
          {...fieldState("name", fieldErrors.name)}
          className={inputClass}
        />
      </FormField>

      <ApiKeyKindFields
        canCreateService={canCreateService}
        kind={state.kind}
        roleCap={state.roleCap}
        onKindChange={handleKindChange}
        onRoleCapChange={handleRoleCapChange}
        fieldErrors={fieldErrors}
        messages={messages}
      />

      <ApiKeyScopeChoices
        kind={state.kind}
        roleCap={state.roleCap}
        selected={state.scopes}
        onToggle={(scope, checked) => dispatch({ type: "scope", scope, checked })}
        fieldErrors={fieldErrors}
        messages={messages}
      />

      {error && <CreateErrorAlert error={error} messages={messages} />}

      <FormActions>
        <Link href="/keys" className={cancelClass}>
          {t("Cancel", messages)}
        </Link>
        <Button type="submit" variant="primary" className="min-h-11" disabled={submitting}>
          {submitting ? t("Creating…", messages) : t("Create API key", messages)}
        </Button>
      </FormActions>
    </form>
  );
}

interface ApiKeyCreateFormProps {
  canCreateService: boolean;
  messages: TranslationMap;
}

/**
 * Creation form on its own page. The plaintext secret lives only in component
 * state and is shown once: never a URL, a cookie, storage or a log. The shared
 * create-form flow resets on every visit, so "Done" and a new "New" never show
 * the previous secret.
 */
export function ApiKeyCreateForm({ canCreateService, messages }: ApiKeyCreateFormProps) {
  const router = useRouter();
  const createForm = useCreateForm();

  async function handleSubmit(input: CreateApiKeyInput) {
    createForm.dispatch({ type: "submit" });
    const result = await createApiKey(input);

    if (!result.ok) {
      createForm.dispatch({
        type: "failed",
        error: result,
        fieldErrors: result.details?.fieldErrors ?? {},
      });
      return;
    }

    createForm.dispatch({ type: "created", result: result.secret ?? null });
    router.refresh();
  }

  async function handleCopy() {
    if (!createForm.result) return;
    // The secret stays in a selectable <input> if every copy path fails.
    const ok = await copyText(createForm.result);
    createForm.dispatch({ type: "copy", ok });
  }

  if (createForm.phase === "created") {
    return (
      <ApiKeyCreatedPanel
        secret={createForm.result}
        copied={createForm.copied}
        copyFailed={createForm.copyFailed}
        onCopy={handleCopy}
        messages={messages}
      />
    );
  }

  return (
    <ApiKeyCreateFormBody
      key={createForm.formKey}
      canCreateService={canCreateService}
      submitting={createForm.submitting}
      error={createForm.error}
      fieldErrors={createForm.fieldErrors}
      onSubmit={handleSubmit}
      onInvalid={(fieldErrors) => createForm.dispatch({ type: "failed", error: null, fieldErrors })}
      onClearFieldError={(field) => createForm.dispatch({ type: "clear-field-error", field })}
      messages={messages}
    />
  );
}
