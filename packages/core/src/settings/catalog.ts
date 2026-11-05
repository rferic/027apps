/**
 * Instance settings catalog: the 18 canonical keys (instance-config spec §4).
 *
 * The catalog is the single source of truth for metadata (label, help, type,
 * secret/public, mcp_access, sort) and validation schemas. The database is
 * seeded from it by migration `0002_settings.sql`; a drift between catalog and
 * seed fails the db-tests sync check. API writes never change metadata: the
 * PATCH body carries only `value`.
 */

import { z } from 'zod';

export type SettingType =
  | 'string'
  | 'int'
  | 'url'
  | 'locale'
  | 'currency'
  | 'locales'
  | 'json'
  | 'enum'
  | 'array';

export const SUPPORTED_LOCALES = ['en', 'es', 'ca', 'it', 'fr', 'de', 'pt', 'gl', 'eu'] as const;

export interface SettingCategoryMeta {
  categoryKey: string;
  label: string;
  help: string;
  icon: string;
  sortOrder: number;
}

export interface SettingMeta {
  /** Canonical key: `<category_key>.<name>`, e.g. "instance.name". */
  key: string;
  category: string;
  type: SettingType;
  label: string;
  help: string;
  isSecret: boolean;
  isPublic: boolean;
  mcpAccess: 'none' | 'read' | 'write';
  sortOrder: number;
  /** `security.*` and public_url/cors_allowlist require the super_admin. */
  superAdminOnly: boolean;
  /** `security.jwt_expiry` is read-only: Supabase owns the value. */
  readOnly: boolean;
  schema: z.ZodType;
  /** Cross-key coherence, validated with the full settings map on write. */
  validateCoherence?: (all: Record<string, unknown>) => void;
}

const localeSchema = z.enum(SUPPORTED_LOCALES);
const enabledLocalesSchema = z
  .array(localeSchema)
  .min(1)
  .refine((locales) => locales.includes('en'), { message: 'en is mandatory' })
  .refine((locales) => new Set(locales).size === locales.length, { message: 'duplicated locales' });

const ianaTimezoneSchema = z.string().refine(
  (tz) => Intl.supportedValuesOf('timeZone').includes(tz),
  { message: 'not a valid IANA timezone' },
);

const publicUrlSchema = z
  .string()
  .regex(/^https:\/\/[^/]+$/, 'must be an https origin without trailing slash');

const corsOriginSchema = z
  .string()
  .regex(/^https?:\/\/[^/*]+\.[^/*]+$/, 'must be an origin like https://host[:port], no paths, no wildcard');

const corsAllowlistSchema = z.array(corsOriginSchema).max(20);

const fcmServiceAccountSchema = z
  .object({
    type: z.literal('service_account'),
    project_id: z.string().min(1),
    private_key: z.string().refine((k) => k.includes('-----BEGIN PRIVATE KEY-----'), {
      message: 'must be a PEM private key',
    }),
    client_email: z.string().min(1),
    token_uri: z.string().min(1),
    client_id: z.string().min(1),
  })
  .loose();

const intInRange = (min: number, max: number) => z.number().int().min(min).max(max);

export const SETTINGS_CATEGORIES: SettingCategoryMeta[] = [
  { categoryKey: 'instance', label: 'Instance', help: 'Instance identity and public links.', icon: 'server', sortOrder: 10 },
  { categoryKey: 'localization', label: 'Localization', help: 'Languages, timezone and currency.', icon: 'globe', sortOrder: 20 },
  { categoryKey: 'security', label: 'Security', help: 'JWT, CORS and other security-relevant values.', icon: 'shield', sortOrder: 30 },
  { categoryKey: 'notifications', label: 'Notifications', help: 'Push notification provider (FCM).', icon: 'bell', sortOrder: 40 },
  { categoryKey: 'rate_limit', label: 'Rate limits', help: 'Per-identity request limits (per minute).', icon: 'gauge', sortOrder: 50 },
];

/** FCM keys that must be present when `notifications.push.provider = fcm`. */
const FCM_REQUIRED_KEYS = [
  'notifications.push.fcm_project_id',
  'notifications.push.fcm_app_id',
  'notifications.push.fcm_api_key',
  'notifications.push.fcm_sender_id',
  'notifications.push.fcm_service_account',
] as const;

export const SETTINGS_CATALOG: SettingMeta[] = [
  {
    key: 'instance.name', category: 'instance', type: 'string',
    label: 'Instance name', help: 'Public name of this 027Apps instance.',
    isSecret: false, isPublic: true, mcpAccess: 'read', sortOrder: 10,
    superAdminOnly: false, readOnly: false,
    schema: z.string().min(1).max(80),
  },
  {
    key: 'instance.logo_url', category: 'instance', type: 'url',
    label: 'Logo URL', help: 'Optional https URL of the instance logo (defaults to the 027Apps mark).',
    isSecret: false, isPublic: true, mcpAccess: 'read', sortOrder: 15,
    superAdminOnly: false, readOnly: false,
    schema: z.string().regex(/^https:\/\/[^\s]+$/, 'must be an https URL').nullable(),
  },
  {
    key: 'instance.public_url', category: 'instance', type: 'url',
    label: 'Public URL', help: 'https origin used for invitation links and deep links.',
    isSecret: false, isPublic: true, mcpAccess: 'none', sortOrder: 20,
    superAdminOnly: true, readOnly: false,
    schema: publicUrlSchema,
  },
  {
    key: 'localization.default_locale', category: 'localization', type: 'locale',
    label: 'Default locale', help: 'Locale for users without a preference.',
    isSecret: false, isPublic: true, mcpAccess: 'read', sortOrder: 10,
    superAdminOnly: false, readOnly: false,
    schema: localeSchema,
    validateCoherence(all) {
      const enabled = all['localization.enabled_locales'] as string[] | undefined;
      if (Array.isArray(enabled) && !enabled.includes(all['localization.default_locale'] as string)) {
        throw new Error('default_locale must be in enabled_locales');
      }
    },
  },
  {
    key: 'localization.timezone', category: 'localization', type: 'string',
    label: 'Timezone', help: 'IANA timezone for dates shown by the instance.',
    isSecret: false, isPublic: true, mcpAccess: 'read', sortOrder: 20,
    superAdminOnly: false, readOnly: false,
    schema: ianaTimezoneSchema,
  },
  {
    key: 'localization.default_currency', category: 'localization', type: 'currency',
    label: 'Default currency', help: 'ISO 4217 code, must exist and be enabled.',
    isSecret: false, isPublic: true, mcpAccess: 'read', sortOrder: 30,
    superAdminOnly: false, readOnly: false,
    schema: z.string().regex(/^[A-Z]{3}$/, 'must be an ISO 4217 code'),
    // Currency coherence (enabled + exists) is checked by the settings service
    // against the currencies table — not by this catalog function.
  },
  {
    key: 'localization.enabled_locales', category: 'localization', type: 'locales',
    label: 'Enabled locales', help: 'Subset of the 9 supported locales; en cannot be removed.',
    isSecret: false, isPublic: true, mcpAccess: 'read', sortOrder: 40,
    superAdminOnly: false, readOnly: false,
    schema: enabledLocalesSchema,
  },
  {
    key: 'security.jwt_expiry', category: 'security', type: 'int',
    label: 'JWT expiry (s)', help: 'Supabase access token lifetime, reflected (read-only).',
    isSecret: false, isPublic: false, mcpAccess: 'none', sortOrder: 10,
    superAdminOnly: true, readOnly: true,
    schema: intInRange(60, 3600),
  },
  {
    key: 'security.cors_allowlist', category: 'security', type: 'array',
    label: 'CORS allowlist', help: 'Origins allowed by the API door (max 20, no wildcard, no paths).',
    isSecret: false, isPublic: false, mcpAccess: 'none', sortOrder: 20,
    superAdminOnly: true, readOnly: false,
    schema: corsAllowlistSchema,
  },
  {
    key: 'notifications.push.provider', category: 'notifications', type: 'enum',
    label: 'Push provider', help: 'fcm or none.',
    isSecret: false, isPublic: false, mcpAccess: 'none', sortOrder: 10,
    superAdminOnly: false, readOnly: false,
    schema: z.enum(['fcm', 'none']),
    validateCoherence(all) {
      if (all['notifications.push.provider'] !== 'fcm') return;
      const missing = FCM_REQUIRED_KEYS.filter((key) => {
        const meta = getSettingMeta(key);
        if (meta?.isSecret) return !all[key]; // secret: "configured" is truthy when set
        return all[key] === undefined || all[key] === null;
      });
      if (missing.length > 0) {
        throw new Error(`provider=fcm requires all FCM keys (${missing.join(', ')})`);
      }
    },
  },
  {
    key: 'notifications.push.fcm_project_id', category: 'notifications', type: 'string',
    label: 'FCM project id', help: 'Firebase project id.',
    isSecret: false, isPublic: true, mcpAccess: 'read', sortOrder: 20,
    superAdminOnly: false, readOnly: false,
    schema: z.string().min(1).max(128),
    validateCoherence(all) {
      const sa = all['notifications.push.fcm_service_account'];
      // Already-configured secrets reach coherence as the "configured" sentinel,
      // not as JSON: the cross-key check only runs when the plaintext is in hand
      // (i.e. when the service account itself is being written).
      if (typeof sa !== 'string') return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(sa);
      } catch {
        return;
      }
      const account = fcmServiceAccountSchema.safeParse(parsed);
      if (account.success && account.data.project_id !== all['notifications.push.fcm_project_id']) {
        throw new Error('fcm_service_account project_id must match fcm_project_id');
      }
    },
  },
  {
    key: 'notifications.push.fcm_app_id', category: 'notifications', type: 'string',
    label: 'FCM app id', help: 'Firebase web app id.',
    isSecret: false, isPublic: true, mcpAccess: 'read', sortOrder: 30,
    superAdminOnly: false, readOnly: false,
    schema: z.string().min(1).max(256),
  },
  {
    key: 'notifications.push.fcm_api_key', category: 'notifications', type: 'string',
    label: 'FCM API key', help: 'Firebase web API key (client key, not a legacy server key).',
    isSecret: false, isPublic: true, mcpAccess: 'read', sortOrder: 40,
    superAdminOnly: false, readOnly: false,
    schema: z.string().min(1).max(128),
  },
  {
    key: 'notifications.push.fcm_sender_id', category: 'notifications', type: 'string',
    label: 'FCM sender id', help: 'Firebase sender id.',
    isSecret: false, isPublic: true, mcpAccess: 'read', sortOrder: 50,
    superAdminOnly: false, readOnly: false,
    schema: z.string().min(1).max(64),
  },
  {
    key: 'notifications.push.fcm_service_account', category: 'notifications', type: 'json',
    label: 'FCM service account', help: 'Service account JSON used to sign pushes (secret).',
    isSecret: true, isPublic: false, mcpAccess: 'none', sortOrder: 60,
    superAdminOnly: false, readOnly: false,
    schema: z.string().max(10_240).refine((v) => fcmServiceAccountSchema.safeParse(JSON.parse(v)).success, {
      message: 'invalid service account JSON',
    }),
  },
  {
    key: 'rate_limit.mobile_per_min', category: 'rate_limit', type: 'int',
    label: 'Mobile per minute', help: 'Requests per minute from the mobile app.',
    isSecret: false, isPublic: false, mcpAccess: 'none', sortOrder: 10,
    superAdminOnly: false, readOnly: false,
    schema: intInRange(1, 10_000),
  },
  {
    key: 'rate_limit.api_key_per_min', category: 'rate_limit', type: 'int',
    label: 'API key per minute', help: 'Requests per minute per service key.',
    isSecret: false, isPublic: false, mcpAccess: 'none', sortOrder: 20,
    superAdminOnly: false, readOnly: false,
    schema: intInRange(1, 10_000),
  },
  {
    key: 'rate_limit.write_per_min', category: 'rate_limit', type: 'int',
    label: 'Write per minute', help: 'Write requests per minute.',
    isSecret: false, isPublic: false, mcpAccess: 'none', sortOrder: 30,
    superAdminOnly: false, readOnly: false,
    schema: intInRange(1, 10_000),
  },
  {
    key: 'rate_limit.public_per_min', category: 'rate_limit', type: 'int',
    label: 'Public per minute', help: 'Requests per minute for public doors.',
    isSecret: false, isPublic: false, mcpAccess: 'none', sortOrder: 40,
    superAdminOnly: false, readOnly: false,
    schema: intInRange(1, 10_000),
  },
];

const CATALOG_BY_KEY: Map<string, SettingMeta> = new Map(
  SETTINGS_CATALOG.map((meta) => [meta.key, meta]),
);

export function getSettingMeta(key: string): SettingMeta | undefined {
  return CATALOG_BY_KEY.get(key);
}

/** Default values from the spec table §4 (jsonb `value`, secrets have no default). */
export const CATALOG_DEFAULTS: Record<string, unknown> = {
  'instance.name': '027Apps',
  'instance.logo_url': null,
  'instance.public_url': null,
  'localization.default_locale': 'en',
  'localization.timezone': 'UTC',
  'localization.default_currency': 'EUR',
  'localization.enabled_locales': ['en'],
  'security.jwt_expiry': 900,
  'security.cors_allowlist': [],
  'notifications.push.provider': 'none',
  'notifications.push.fcm_project_id': null,
  'notifications.push.fcm_app_id': null,
  'notifications.push.fcm_api_key': null,
  'notifications.push.fcm_sender_id': null,
  'notifications.push.fcm_service_account': null,
  'rate_limit.mobile_per_min': 120,
  'rate_limit.api_key_per_min': 30,
  'rate_limit.write_per_min': 10,
  'rate_limit.public_per_min': 30,
};
