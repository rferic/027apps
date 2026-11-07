"use client";

import { useRef, useState, type FormEvent, type RefObject, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, FormActions, FormAlert, FormField } from "@/components/ui/form";
import { createApiKey, type CreateApiKeyInput } from "@/lib/api-key-mutations";
import {
  API_KEY_SCOPE_GROUPS,
  allowedApiKeyScopes,
  type ApiKeyScopeRoleCap,
  type ScopeGroupId,
} from "@/lib/api-key-scopes";
import type { MutationFailure } from "@/lib/mutation-result";

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type KeyKind = "service" | "delegated";

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

function buildCreateInput(data: FormData, kind: KeyKind): CreateApiKeyInput {
  const scopes = data
    .getAll("scopes")
    .map((value) => String(value))
    .filter((value) => value.length > 0);
  const input: CreateApiKeyInput = {
    kind,
    name: String(data.get("name") ?? "").trim(),
    scopes,
  };
  if (kind === "service") {
    const roleCap = String(data.get("role_cap") ?? "");
    if (roleCap === "admin" || roleCap === "super_admin") input.role_cap = roleCap;
  }
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
  onCopy,
  messages,
}: {
  secret: string;
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
      <p className="text-xs text-muted-foreground">
        {t("The key is stored hashed. If you lose it, revoke it and create another.", messages)}
      </p>
    </div>
  );
}

function ScopeChoices({
  kind,
  roleCap,
  fieldErrors,
  messages,
}: {
  kind: KeyKind;
  roleCap: ApiKeyScopeRoleCap;
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
                <input type="checkbox" name="scopes" value={scope} />
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

function KindFields({
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
  roleCap: ApiKeyScopeRoleCap;
  onKindChange: (kind: KeyKind) => void;
  onRoleCapChange: (roleCap: ApiKeyScopeRoleCap) => void;
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
        <select
          id="api-key-kind"
          name="kind"
          value={kind}
          onChange={(event) => onKindChange(event.target.value === "service" ? "service" : "delegated")}
          {...fieldState("kind", fieldErrors.kind, "api-key-kind-help")}
          className={inputClass}
        >
          <option value="delegated">{t("Delegated", messages)}</option>
          {canCreateService && <option value="service">{t("Service", messages)}</option>}
        </select>
      </FormField>

      {kind === "service" && canCreateService && (
        <FormField
          id="api-key-role-cap"
          label={t("Role cap", messages)}
          error={fieldErrors.role_cap?.[0]}
          errorId="api-key-role-cap-error"
        >
          <select
            id="api-key-role-cap"
            name="role_cap"
            value={roleCap}
            onChange={(event) =>
              onRoleCapChange(event.target.value === "super_admin" ? "super_admin" : "admin")
            }
            {...fieldState("role_cap", fieldErrors.role_cap)}
            className={inputClass}
          >
            <option value="admin">{t("Administrator", messages)}</option>
            <option value="super_admin">{t("Super administrator", messages)}</option>
          </select>
        </FormField>
      )}
    </>
  );
}

interface ApiKeyCreateDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  canCreateService: boolean;
  kind: KeyKind;
  roleCap: ApiKeyScopeRoleCap;
  creating: boolean;
  created: boolean;
  secret: string | null;
  copied: boolean;
  error: MutationFailure | null;
  fieldErrors: Record<string, string[]>;
  onKindChange: (kind: KeyKind) => void;
  onRoleCapChange: (roleCap: ApiKeyScopeRoleCap) => void;
  onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void;
  onDismiss: () => void;
  onClosed: () => void;
  onCopy: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  messages: TranslationMap;
}

/**
 * The dialog body. Once the secret exists the form is not rendered: creating
 * a second key in the same dialog would hide the only copy of the first secret
 * (the Core returns it once), so the only way out is "Done".
 */
export function ApiKeyCreateDialog({
  dialogRef,
  canCreateService,
  kind,
  roleCap,
  creating,
  created,
  secret,
  copied,
  error,
  fieldErrors,
  onKindChange,
  onRoleCapChange,
  onCancel,
  onDismiss,
  onClosed,
  onCopy,
  onSubmit,
  messages,
}: ApiKeyCreateDialogProps) {
  const finished = created || secret !== null;

  return (
    <Dialog
      labelledBy="api-key-create-title"
      ref={dialogRef}
      onCancel={onCancel}
      onClose={onClosed}
      onBackdropClick={creating ? undefined : onDismiss}
    >
      <h2 id="api-key-create-title" className="text-sm font-semibold">
        {created ? t("API key created", messages) : t("New API key", messages)}
      </h2>

      {finished ? (
        <>
          {secret ? (
            <SecretPanel
              secret={secret}
              copied={copied}
              onCopy={onCopy}
              messages={messages}
            />
          ) : (
            <p role="status" className="mt-3 text-xs text-muted-foreground">
              {t("The key was created but the API did not return the secret.", messages)}
            </p>
          )}
          <FormActions>
            <Button variant="secondary" className="min-h-11" onClick={onDismiss}>
              {t("Done", messages)}
            </Button>
          </FormActions>
        </>
      ) : (
        <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3">
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

          <KindFields
            canCreateService={canCreateService}
            kind={kind}
            roleCap={roleCap}
            onKindChange={onKindChange}
            onRoleCapChange={onRoleCapChange}
            fieldErrors={fieldErrors}
            messages={messages}
          />

          <ScopeChoices
            kind={kind}
            roleCap={roleCap}
            fieldErrors={fieldErrors}
            messages={messages}
          />

          {error && <CreateErrorAlert error={error} messages={messages} />}

          <FormActions>
            <Button variant="secondary" className="min-h-11" onClick={onDismiss} disabled={creating}>
              {t("Cancel", messages)}
            </Button>
            <Button type="submit" variant="primary" className="min-h-11" disabled={creating}>
              {creating ? t("Creating…", messages) : t("Create API key", messages)}
            </Button>
          </FormActions>
        </form>
      )}
    </Dialog>
  );
}

/**
 * Creation form. The plaintext secret lives only in component state and is
 * cleared when the dialog closes: never a URL, a cookie, storage or a log.
 */
export function ApiKeyCreateForm({
  canCreateService,
  messages,
}: {
  canCreateService: boolean;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<KeyKind>("delegated");
  const [roleCap, setRoleCap] = useState<ApiKeyScopeRoleCap>("admin");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<MutationFailure | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [secret, setSecret] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState(false);

  function resetState() {
    setKind("delegated");
    setRoleCap("admin");
    setError(null);
    setFieldErrors({});
    setSecret(null);
    setCreated(false);
    setCopied(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setCreating(true);
    setError(null);
    setFieldErrors({});
    const result = await createApiKey(buildCreateInput(new FormData(form), kind));
    setCreating(false);

    if (!result.ok) {
      setFieldErrors(result.details?.fieldErrors ?? {});
      setError(result);
      return;
    }

    form.reset();
    setSecret(result.secret ?? null);
    setCreated(true);
    setCopied(false);
    router.refresh();
  }

  async function handleCopy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
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
        {t("Create API key", messages)}
      </Button>

      <ApiKeyCreateDialog
        dialogRef={dialogRef}
        canCreateService={canCreateService}
        kind={kind}
        roleCap={roleCap}
        creating={creating}
        created={created}
        secret={secret}
        copied={copied}
        error={error}
        fieldErrors={fieldErrors}
        onKindChange={setKind}
        onRoleCapChange={setRoleCap}
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
