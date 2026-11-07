"use client";

import { useState, type FormEvent } from "react";
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

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const secondaryLinkClass =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-muted px-2.5 text-xs font-semibold text-foreground hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const cancelClass =
  "inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
            value={roleCap}
            onChange={(event) =>
              onRoleCapChange(event.target.value === "super_admin" ? "super_admin" : "admin")
            }
            {...fieldState("role_cap", fieldErrors.role_cap)}
          >
            <option value="admin">{t("Administrator", messages)}</option>
            <option value="super_admin">{t("Super administrator", messages)}</option>
          </Select>
        </FormField>
      )}
    </>
  );
}

interface ApiKeyCreateFormProps {
  canCreateService: boolean;
  messages: TranslationMap;
}

/**
 * Creation form on its own page. The plaintext secret lives only in component
 * state and is shown once: never a URL, a cookie, storage or a log.
 */
export function ApiKeyCreateForm({ canCreateService, messages }: ApiKeyCreateFormProps) {
  const router = useRouter();
  const [kind, setKind] = useState<KeyKind>("delegated");
  const [roleCap, setRoleCap] = useState<ApiKeyScopeRoleCap>("admin");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<MutationFailure | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [secret, setSecret] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

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
    setCopyFailed(false);
    router.refresh();
  }

  async function handleCopy() {
    if (!secret) return;
    // The secret stays in a selectable <input> if every copy path fails.
    const ok = await copyText(secret);
    setCopied(ok);
    setCopyFailed(!ok);
  }

  if (created) {
    return (
      <ApiKeyCreatedPanel
        secret={secret}
        copied={copied}
        copyFailed={copyFailed}
        onCopy={handleCopy}
        messages={messages}
      />
    );
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
        kind={kind}
        roleCap={roleCap}
        onKindChange={setKind}
        onRoleCapChange={setRoleCap}
        fieldErrors={fieldErrors}
        messages={messages}
      />

      <ApiKeyScopeChoices kind={kind} roleCap={roleCap} fieldErrors={fieldErrors} messages={messages} />

      {error && <CreateErrorAlert error={error} messages={messages} />}

      <FormActions>
        <Link href="/keys" className={cancelClass}>
          {t("Cancel", messages)}
        </Link>
        <Button type="submit" variant="primary" className="min-h-11" disabled={creating}>
          {creating ? t("Creating…", messages) : t("Create API key", messages)}
        </Button>
      </FormActions>
    </form>
  );
}
