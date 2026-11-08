/**
 * Plain view types shared by the server loaders (`panel-settings.ts`) and the
 * client form. They carry only what the API returns plus the catalog metadata
 * the server joins in (`type`, `superAdminOnly`, `readOnly`); the client never
 * imports the catalog itself.
 */

export type SettingType =
  | "string"
  | "int"
  | "url"
  | "locale"
  | "currency"
  | "locales"
  | "json"
  | "enum"
  | "array";

/** A `SettingView` from `packages/core/src/settings/service.ts`. */
export interface SettingRow {
  key: string;
  category: string;
  label: string;
  help: string;
  type: SettingType;
  isSecret: boolean;
  isPublic: boolean;
  superAdminOnly: boolean;
  readOnly: boolean;
  sortOrder: number;
  updatedBy: string | null;
  updatedAt: string;
  /** Present for non-secrets only. */
  value?: unknown;
  /** Present for secrets only. */
  configured?: boolean;
}

export interface SettingsCategoryRow {
  categoryKey: string;
  label: string;
  help: string;
  icon: string;
  sortOrder: number;
  settings: SettingRow[];
}

/** A super-admin-only setting hidden from an `admin` read, with its catalog text. */
export interface RestrictedSetting {
  key: string;
  category: string;
  label: string;
  help: string;
  readOnly: boolean;
}

export interface CurrencyRow {
  code: string;
  enabled: boolean;
  isDefault: boolean;
}

export interface CurrencyList {
  default: string | null;
  currencies: CurrencyRow[];
}
