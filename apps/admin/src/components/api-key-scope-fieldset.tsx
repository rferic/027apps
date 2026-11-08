import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { FieldError } from "@/components/ui/form";
import { apiKeyOfferedScopes } from "@/lib/api-key-module-scopes";
import {
  API_KEY_SCOPE_GROUPS,
  type ApiKeyScopeKind,
  type ApiKeyScopeRoleCap,
  type ScopeGroupId,
} from "@/lib/api-key-scopes";
import type { UserModule } from "@/lib/panel-user-modules";

const bulkActionClass =
  "inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline";

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

/** Core groups narrowed to the offered scopes; empty groups are dropped. */
function offeredGroups(
  kind: ApiKeyScopeKind,
  roleCap: ApiKeyScopeRoleCap | "",
  modules: readonly UserModule[],
) {
  const allowed = new Set(apiKeyOfferedScopes(kind, roleCap, modules));
  return API_KEY_SCOPE_GROUPS.map((group) => ({
    ...group,
    scopes: group.scopes.filter((scope) => allowed.has(scope)),
  })).filter((group) => group.scopes.length > 0);
}

function everyOfferedSelected(offered: readonly string[], selected: readonly string[]): boolean {
  return offered.every((scope) => selected.includes(scope));
}

/**
 * Bulk selection is only available once the allowlist is resolved (a delegated
 * key, or a service key with a cap), and each button is off when it would not
 * change the selection.
 */
function bulkDisabled(options: {
  kind: ApiKeyScopeKind;
  roleCap: ApiKeyScopeRoleCap | "";
  offered: readonly string[];
  selected: readonly string[];
}): { selectAll: boolean; clearAll: boolean } {
  const { kind, roleCap, offered, selected } = options;
  const available = kind === "delegated" || roleCap !== "";
  const all = available && everyOfferedSelected(offered, selected);
  return {
    selectAll: !available || offered.length === 0 || all,
    clearAll: !available || offered.length === 0 || selected.length === 0,
  };
}

const SCOPE_ERROR_ID = "api-key-scopes-error";

/**
 * Module permissions, one row per module granted to the key's owner. They are
 * plain `name="scopes"` checkboxes like the Core ones, so the form submits a
 * single set; the "read and write implies read" rule lives in the form state
 * helpers, not in the DOM.
 */
function ModulePermissions({
  modules,
  selected,
  onToggle,
  hasError,
  messages,
}: {
  modules: readonly UserModule[];
  selected: readonly string[];
  onToggle: (scope: string, checked: boolean) => void;
  hasError: boolean;
  messages: TranslationMap;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("Module permissions", messages)}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("Only modules granted to the owner can be selected.", messages)}
      </p>
      <div className="flex flex-col gap-2">
        {modules.map((module) => {
          const read = `${module.key}:read`;
          const readWrite = `${module.key}:read_write`;
          return (
            <div key={module.key} className="flex flex-col gap-1">
              <p className="flex flex-wrap items-baseline gap-2 text-xs font-semibold">
                {module.name}
                <span className="font-mono text-[11px] text-muted-foreground">{module.key}</span>
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <label className="flex min-h-11 items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="scopes"
                    value={read}
                    checked={selected.includes(read)}
                    aria-describedby={hasError ? SCOPE_ERROR_ID : undefined}
                    onChange={(event) => onToggle(read, event.target.checked)}
                  />
                  {t("Read", messages)}
                </label>
                <label className="flex min-h-11 items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="scopes"
                    value={readWrite}
                    checked={selected.includes(readWrite)}
                    aria-describedby={hasError ? SCOPE_ERROR_ID : undefined}
                    onChange={(event) => onToggle(readWrite, event.target.checked)}
                  />
                  {t("Read and write", messages)}
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Scope checkboxes shared by the create and edit forms. The Core allowlist
 * always comes from the policy (`kind`, `roleCap`), so neither form can offer a
 * permission the key could not use. A delegated key also offers the module
 * scopes granted to its owner (`modules`), which the caller loads; they are
 * never offered for a service key. Checkboxes carry `name="scopes"` so a form
 * action receives exactly the selected set.
 */
export function ApiKeyScopeFieldset({
  kind,
  roleCap,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  modules = [],
  fieldErrors,
  messages,
}: {
  kind: ApiKeyScopeKind;
  roleCap: ApiKeyScopeRoleCap | "";
  selected: readonly string[];
  onToggle: (scope: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  /** Modules granted to the owner; empty for a service key or no owner. */
  modules?: readonly UserModule[];
  fieldErrors: Record<string, string[]>;
  messages: TranslationMap;
}) {
  const offered = apiKeyOfferedScopes(kind, roleCap, modules);
  const groups = offeredGroups(kind, roleCap, modules);
  const { selectAll, clearAll } = bulkDisabled({ kind, roleCap, offered, selected });
  const visibleModules = kind === "delegated" ? modules : [];

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-semibold">{t("Scopes", messages)}</legend>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={bulkActionClass}
          onClick={onSelectAll}
          disabled={selectAll}
        >
          {t("Select all", messages)}
        </button>
        <button
          type="button"
          className={bulkActionClass}
          onClick={onClearAll}
          disabled={clearAll}
        >
          {t("Clear all", messages)}
        </button>
      </div>
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
      {visibleModules.length > 0 && (
        <ModulePermissions
          modules={visibleModules}
          selected={selected}
          onToggle={onToggle}
          hasError={Boolean(fieldErrors.scopes?.[0])}
          messages={messages}
        />
      )}
      <FieldError id={SCOPE_ERROR_ID} message={fieldErrors.scopes?.[0]} />
    </fieldset>
  );
}
