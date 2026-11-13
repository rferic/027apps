"use client";

import { useEffect, useReducer, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { ApiKeyExpiryField } from "@/components/api-key-expiry-field";
import { ApiKeyScopeFieldset } from "@/components/api-key-scope-fieldset";
import { Button } from "@/components/ui/button";
import { FormActions, FormAlert, FormField, cancelClass, inputClass } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { selectAllKeyScopes, toggleKeyScope } from "@/lib/api-key-edit";
import { expiresAtFrom, type ExpiryChoice } from "@/lib/api-key-expiry";
import { apiKeyOfferedScopes } from "@/lib/api-key-module-scopes";
import { createApiKey, type CreateApiKeyInput } from "@/lib/api-key-mutations";
import type { ApiKeyScopeRoleCap } from "@/lib/api-key-scopes";
import { copyText } from "@/lib/clipboard";
import type { MutationFailure } from "@/lib/mutation-result";
import type { ApiKeyOwner } from "@/lib/panel-keys";
import type { UserModule, UserModulesResult } from "@/lib/panel-user-modules";
import { useCreateForm } from "@/lib/use-create-form";

const secondaryLinkClass =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-muted px-2.5 text-xs font-semibold text-foreground hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type KeyKind = "service" | "delegated";

/** Empty until the user picks a cap; a service key cannot be created without it. */
export type ApiKeyRoleCap = ApiKeyScopeRoleCap | "";

/** Mirrors the Core limit; the API still enforces it inside a transaction. */
export const MAX_ACTIVE_DELEGATED_KEYS = 5;

/** A delegated key cannot be created for an owner already at the limit. */
function ownerAtLimit(
  kind: KeyKind,
  ownerId: string,
  activeCounts: Readonly<Record<string, number>>,
): boolean {
  return kind === "delegated" && (activeCounts[ownerId] ?? 0) >= MAX_ACTIVE_DELEGATED_KEYS;
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
  /** Empty means the current user; only a super_admin can pick another. */
  ownerId: string;
  scopes: readonly string[];
  /** Modules granted to the effective owner; always empty for a service key. */
  modules: readonly UserModule[];
}

export const INITIAL_API_KEY_FORM_STATE: ApiKeyFormState = {
  kind: "delegated",
  roleCap: "",
  ownerId: "",
  scopes: [],
  modules: [],
};

export type ApiKeyFormAction =
  | { type: "kind"; kind: KeyKind }
  | { type: "role-cap"; roleCap: ApiKeyRoleCap }
  | { type: "owner"; ownerId: string }
  | { type: "modules"; modules: readonly UserModule[] }
  | { type: "scope"; scope: string; checked: boolean }
  | { type: "select-all-scopes" }
  | { type: "clear-scopes" }
  | { type: "reset" };

function normalizeRoleCap(value: string): ApiKeyRoleCap {
  if (value === "admin" || value === "super_admin") return value;
  return "";
}

function pruneScopes(
  kind: KeyKind,
  roleCap: ApiKeyRoleCap,
  scopes: readonly string[],
  modules: readonly UserModule[],
): readonly string[] {
  const allowed = new Set(apiKeyOfferedScopes(kind, roleCap, modules));
  return scopes.filter((scope) => allowed.has(scope));
}

/** Applies one checkbox against the scopes offered for the current kind and cap. */
function withScopeToggled(
  state: ApiKeyFormState,
  scope: string,
  checked: boolean,
): ApiKeyFormState {
  const allowed = apiKeyOfferedScopes(state.kind, state.roleCap, state.modules);
  const scopes = toggleKeyScope(state.scopes, scope, checked, allowed);
  return scopes === state.scopes ? state : { ...state, scopes };
}

/** A service key without a cap cannot be created yet, so there is no "all" to pick. */
function withAllScopes(state: ApiKeyFormState): ApiKeyFormState {
  if (state.kind === "service" && !state.roleCap) return state;
  const offered = apiKeyOfferedScopes(state.kind, state.roleCap, state.modules);
  if (offered.length === 0) return state;
  return { ...state, scopes: selectAllKeyScopes(offered) };
}

/**
 * Scopes are always derived from `(kind, roleCap, modules)`: changing any of
 * them drops a selection the new set no longer allows, so a stale checkbox can
 * never be submitted and switching back never resurrects it. A new owner starts
 * with no modules, so the previous owner's module scopes are discarded before
 * the new list arrives.
 */
export function apiKeyFormReducer(
  state: ApiKeyFormState,
  action: ApiKeyFormAction,
): ApiKeyFormState {
  switch (action.type) {
    case "kind":
      // The cap belongs to the service kind: it must be chosen again. The
      // owner belongs to the delegated kind and falls back to the actor.
      return {
        kind: action.kind,
        roleCap: "",
        ownerId: "",
        scopes: pruneScopes(action.kind, "", state.scopes, []),
        modules: [],
      };
    case "role-cap": {
      const roleCap = normalizeRoleCap(action.roleCap);
      return {
        ...state,
        roleCap,
        scopes: pruneScopes(state.kind, roleCap, state.scopes, state.modules),
      };
    }
    case "owner":
      return {
        ...state,
        ownerId: action.ownerId,
        modules: [],
        scopes: pruneScopes(state.kind, state.roleCap, state.scopes, []),
      };
    case "modules":
      return {
        ...state,
        modules: action.modules,
        scopes: pruneScopes(state.kind, state.roleCap, state.scopes, action.modules),
      };
    case "scope":
      return withScopeToggled(state, action.scope, action.checked);
    case "select-all-scopes":
      return withAllScopes(state);
    case "clear-scopes":
      return state.scopes.length === 0 ? state : { ...state, scopes: [] };
    case "reset":
      return INITIAL_API_KEY_FORM_STATE;
  }
}

/** Input the API accepts: the owner is only sent when it is not the actor. */
export function buildApiKeyCreateInput(
  fields: {
    kind: KeyKind;
    name: string;
    scopes: readonly string[];
    roleCap?: ApiKeyRoleCap;
    ownerId?: string;
    modules?: readonly UserModule[];
    expiry?: ExpiryChoice;
  },
  currentUserId: string,
): CreateApiKeyInput {
  const allowed = new Set(
    apiKeyOfferedScopes(fields.kind, fields.roleCap ?? "", fields.modules ?? []),
  );
  const input: CreateApiKeyInput = {
    kind: fields.kind,
    name: fields.name.trim(),
    scopes: fields.scopes.filter((scope) => allowed.has(scope)),
  };
  if (fields.kind === "service") {
    if (fields.roleCap) input.role_cap = fields.roleCap;
  } else if (fields.ownerId && fields.ownerId !== currentUserId) {
    input.user_id = fields.ownerId;
  }
  // `never` and `keep` add nothing; only a relative choice stores an instant.
  if (fields.expiry) {
    const expiresAt = expiresAtFrom(fields.expiry);
    if (expiresAt) input.expires_at = expiresAt;
  }
  return input;
}

/** Failure banner: the five-key limit gets its own explanation. */
export function ApiKeyCreateError({
  error,
  messages,
}: {
  error: MutationFailure;
  messages: TranslationMap;
}) {
  if (error.code === "conflict" && error.details?.code === "key_limit") {
    return (
      <FormAlert
        message={t("This user has reached the limit of {count} active keys.", messages, {
          count: MAX_ACTIVE_DELEGATED_KEYS,
        })}
        details={[t("Revoke one key to create another.", messages)]}
        requestId={error.requestId}
        messages={messages}
      />
    );
  }
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
        <Link href="/panel/keys" className={secondaryLinkClass}>
          {t("Done", messages)}
        </Link>
      </FormActions>
    </section>
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

/** Owner selector for a delegated key; only a super_admin sees it. */
export function ApiKeyOwnerField({
  owners,
  currentUserId,
  ownerId,
  activeCounts,
  onOwnerChange,
  fieldErrors,
  messages,
}: {
  owners: readonly ApiKeyOwner[];
  currentUserId: string;
  ownerId: string;
  activeCounts: Readonly<Record<string, number>>;
  onOwnerChange: (ownerId: string) => void;
  fieldErrors: Record<string, string[]>;
  messages: TranslationMap;
}) {
  const selected = ownerId || currentUserId;
  const atLimit = ownerAtLimit("delegated", selected, activeCounts);
  const currentListed = owners.some((owner) => owner.id === currentUserId);

  return (
    <FormField
      id="api-key-owner"
      label={t("Owner", messages)}
      hint={t("The key acts for the selected user.", messages)}
      hintId="api-key-owner-help"
      error={fieldErrors.owner_id?.[0] ?? fieldErrors.user_id?.[0]}
      errorId="api-key-owner-error"
    >
      <Select
        id="api-key-owner"
        name="owner_id"
        value={selected}
        onChange={(event) => onOwnerChange(event.target.value)}
        {...fieldState("owner_id", fieldErrors.owner_id, "api-key-owner-help")}
      >
        {!currentListed && <option value={currentUserId}>{t("Me", messages)}</option>}
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.name}
          </option>
        ))}
      </Select>
      {atLimit && (
        <p role="status" className="text-xs font-semibold text-destructive">
          {t("This user has reached the limit of {count} active keys.", messages, {
            count: MAX_ACTIVE_DELEGATED_KEYS,
          })}
        </p>
      )}
    </FormField>
  );
}

interface ApiKeyCreateFormBodyProps {
  canCreateService: boolean;
  canChooseOwner: boolean;
  currentUserId: string;
  owners: readonly ApiKeyOwner[];
  activeCounts: Readonly<Record<string, number>>;
  loadModules: (userId: string) => Promise<UserModulesResult>;
  submitting: boolean;
  error: MutationFailure | null;
  fieldErrors: Record<string, string[]>;
  onSubmit: (input: CreateApiKeyInput) => void;
  onInvalid: (fieldErrors: Record<string, string[]>) => void;
  onClearFieldError: (field: string) => void;
  messages: TranslationMap;
}

interface OwnerModuleLoad {
  loading: boolean;
  error: MutationFailure | null;
}

/**
 * Loads the modules granted to the effective owner. The reducer drops the
 * previous owner's module scopes as soon as the owner changes; an error is
 * tagged with the owner it belongs to, so a stale failure never shows against
 * the new one.
 */
function useOwnerModules(options: {
  kind: KeyKind;
  ownerId: string;
  loadModules: (userId: string) => Promise<UserModulesResult>;
  dispatch: (action: ApiKeyFormAction) => void;
}): OwnerModuleLoad {
  const { kind, ownerId, loadModules, dispatch } = options;
  const [loading, startLoad] = useTransition();
  const [failure, setFailure] = useState<{ ownerId: string; error: MutationFailure } | null>(
    null,
  );
  const modulesOwnerId = kind === "delegated" ? ownerId : "";

  useEffect(() => {
    if (!modulesOwnerId) return;
    let active = true;
    startLoad(async () => {
      const result = await loadModules(modulesOwnerId);
      if (!active) return;
      dispatch({ type: "modules", modules: result.ok ? result.modules : [] });
      setFailure(result.ok ? null : { ownerId: modulesOwnerId, error: result });
    });
    return () => {
      active = false;
    };
  }, [modulesOwnerId, loadModules, dispatch]);

  const error = failure?.ownerId === modulesOwnerId ? failure.error : null;
  return { loading, error };
}

/** Loading hint and failure banner for the owner's module permissions. */
function ModuleLoadStatus({
  loading,
  error,
  messages,
}: {
  loading: boolean;
  error: MutationFailure | null;
  messages: TranslationMap;
}) {
  if (loading) {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        {t("Loading modules…", messages)}
      </p>
    );
  }
  if (!error) return null;
  return (
    <FormAlert
      message={t("We couldn't load the owner's modules.", messages)}
      code={error.code}
      requestId={error.requestId}
      messages={messages}
    />
  );
}

function ApiKeyCreateFormBody({
  canCreateService,
  canChooseOwner,
  currentUserId,
  owners,
  activeCounts,
  loadModules,
  submitting,
  error,
  fieldErrors,
  onSubmit,
  onInvalid,
  onClearFieldError,
  messages,
}: ApiKeyCreateFormBodyProps) {
  const [state, dispatch] = useReducer(apiKeyFormReducer, INITIAL_API_KEY_FORM_STATE);
  const [expiry, setExpiry] = useState<ExpiryChoice>({ mode: "never" });
  const ownerId = state.ownerId || currentUserId;
  const { loading: loadingModules, error: modulesError } = useOwnerModules({
    kind: state.kind,
    ownerId,
    loadModules,
    dispatch,
  });
  const atLimit = ownerAtLimit(state.kind, ownerId, activeCounts);

  function handleKindChange(kind: KeyKind) {
    dispatch({ type: "kind", kind });
    onClearFieldError("role_cap");
  }

  function handleRoleCapChange(roleCap: ApiKeyRoleCap) {
    dispatch({ type: "role-cap", roleCap });
    onClearFieldError("role_cap");
  }

  function handleOwnerChange(nextOwnerId: string) {
    dispatch({ type: "owner", ownerId: nextOwnerId });
    onClearFieldError("owner_id");
    onClearFieldError("user_id");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === "service" && !state.roleCap) {
      onInvalid({ role_cap: [t("Choose a role cap.", messages)] });
      return;
    }
    if (atLimit) return;
    const data = new FormData(event.currentTarget);
    let input: CreateApiKeyInput;
    try {
      input = buildApiKeyCreateInput(
        {
          kind: state.kind,
          name: String(data.get("name") ?? ""),
          scopes: state.scopes,
          roleCap: state.roleCap,
          ownerId: state.ownerId,
          modules: state.modules,
          expiry,
        },
        currentUserId,
      );
    } catch (error) {
      // The browser already blocks an empty or out-of-range amount, but the
      // state can still carry one: report it on the field, never submit.
      if (error instanceof RangeError) {
        onInvalid({
          expiry_amount: [t("Enter a whole number between 1 and 10000.", messages)],
        });
        return;
      }
      throw error;
    }
    onSubmit(input);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
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

      {canChooseOwner && state.kind === "delegated" && (
        <ApiKeyOwnerField
          owners={owners}
          currentUserId={currentUserId}
          ownerId={state.ownerId}
          activeCounts={activeCounts}
          onOwnerChange={handleOwnerChange}
          fieldErrors={fieldErrors}
          messages={messages}
        />
      )}

      <ApiKeyExpiryField
        currentExpiresAt={null}
        currentLabel=""
        value={expiry}
        onChange={(choice) => {
          setExpiry(choice);
          onClearFieldError("expiry_amount");
        }}
        fieldErrors={fieldErrors}
        messages={messages}
      />

      <ModuleLoadStatus loading={loadingModules} error={modulesError} messages={messages} />

      <ApiKeyScopeFieldset
        kind={state.kind}
        roleCap={state.roleCap}
        selected={state.scopes}
        onToggle={(scope, checked) => dispatch({ type: "scope", scope, checked })}
        onSelectAll={() => dispatch({ type: "select-all-scopes" })}
        onClearAll={() => dispatch({ type: "clear-scopes" })}
        modules={state.kind === "delegated" ? state.modules : []}
        fieldErrors={fieldErrors}
        messages={messages}
      />

      {error && <ApiKeyCreateError error={error} messages={messages} />}

      <FormActions>
        <Link href="/panel/keys" className={cancelClass}>
          {t("Cancel", messages)}
        </Link>
        <Button
          type="submit"
          variant="primary"
          className="min-h-11"
          disabled={submitting || atLimit}
        >
          {submitting ? t("Creating…", messages) : t("Create API key", messages)}
        </Button>
      </FormActions>
    </form>
  );
}

interface ApiKeyCreateFormProps {
  canCreateService: boolean;
  canChooseOwner: boolean;
  currentUserId: string;
  owners: readonly ApiKeyOwner[];
  activeCounts: Readonly<Record<string, number>>;
  /** Loads the modules granted to a delegated key's owner (server action). */
  loadModules: (userId: string) => Promise<UserModulesResult>;
  messages: TranslationMap;
}

/**
 * Creation form on its own page. The plaintext secret lives only in component
 * state and is shown once: never a URL, a cookie, storage or a log. The shared
 * create-form flow resets on every visit, so "Done" and a new "New" never show
 * the previous secret.
 */
export function ApiKeyCreateForm({
  canCreateService,
  canChooseOwner,
  currentUserId,
  owners,
  activeCounts,
  loadModules,
  messages,
}: ApiKeyCreateFormProps) {
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
      canChooseOwner={canChooseOwner}
      currentUserId={currentUserId}
      owners={owners}
      activeCounts={activeCounts}
      loadModules={loadModules}
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
