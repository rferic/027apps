import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { FieldError } from "@/components/ui/form";
import {
  API_KEY_SCOPE_GROUPS,
  allowedApiKeyScopes,
  type ApiKeyScopeKind,
  type ApiKeyScopeRoleCap,
  type ScopeGroupId,
} from "@/lib/api-key-scopes";

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

/**
 * Scope checkboxes shared by the create and edit forms. The allowlist always
 * comes from the Core policy (`kind`, `roleCap`), so neither form can offer a
 * permission the key could not use. Checkboxes carry `name="scopes"` so a form
 * action receives exactly the selected set.
 */
export function ApiKeyScopeFieldset({
  kind,
  roleCap,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  fieldErrors,
  messages,
}: {
  kind: ApiKeyScopeKind;
  roleCap: ApiKeyScopeRoleCap | "";
  selected: readonly string[];
  onToggle: (scope: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  fieldErrors: Record<string, string[]>;
  messages: TranslationMap;
}) {
  const offered = allowedApiKeyScopes(kind, roleCap);
  const allowed = new Set(offered);
  const groups = API_KEY_SCOPE_GROUPS.map((group) => ({
    ...group,
    scopes: group.scopes.filter((scope) => allowed.has(scope)),
  })).filter((group) => group.scopes.length > 0);
  // Without a cap the service allowlist is still provisional, so bulk
  // selection is off until the key is actually configurable.
  const bulkAvailable = kind === "delegated" || roleCap !== "";
  const allSelected =
    bulkAvailable && offered.length > 0 && offered.every((scope) => selected.includes(scope));
  const noneSelected = selected.length === 0;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-semibold">{t("Scopes", messages)}</legend>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={bulkActionClass}
          onClick={onSelectAll}
          disabled={!bulkAvailable || offered.length === 0 || allSelected}
        >
          {t("Select all", messages)}
        </button>
        <button
          type="button"
          className={bulkActionClass}
          onClick={onClearAll}
          disabled={!bulkAvailable || offered.length === 0 || noneSelected}
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
      <FieldError id="api-key-scopes-error" message={fieldErrors.scopes?.[0]} />
    </fieldset>
  );
}
