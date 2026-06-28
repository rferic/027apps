import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { cache } from '@/lib/redis'

const SETTINGS_KEY = 'notifications_config'
const CACHE_KEY = 'setting:notifications_config'
const CACHE_TTL = 300

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from_email: string
  from_name: string
}

export interface NotificationsConfig {
  email_enabled: boolean
  push_enabled: boolean
  smtp: SmtpConfig | null
}

const DEFAULTS: NotificationsConfig = {
  email_enabled: true,
  push_enabled: true,
  smtp: null,
}

export async function getNotificationsConfig(): Promise<NotificationsConfig> {
  const cached = await cache.get<NotificationsConfig>(CACHE_KEY)
  if (cached) return cached

  const db = createAdminClientUntyped()
  const { data } = await db
    .from('app_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()

  const parsed = parseConfig(data)
  await cache.set(CACHE_KEY, parsed, CACHE_TTL)
  return parsed
}

function parseConfig(data: { value: unknown } | null | undefined): NotificationsConfig {
  if (!data?.value || typeof data.value !== 'object') return DEFAULTS

  const v = data.value as Record<string, unknown>
  const smtpRaw = v.smtp as Record<string, unknown> | null

  return {
    email_enabled: v.email_enabled !== false,
    push_enabled: v.push_enabled !== false,
    smtp: smtpRaw && smtpRaw.host
      ? {
          host: String(smtpRaw.host),
          port: Number(smtpRaw.port) || 587,
          user: String(smtpRaw.user),
          pass: String(smtpRaw.pass),
          from_email: String(smtpRaw.from_email),
          from_name: String(smtpRaw.from_name || ''),
        }
      : null,
  }
}

export async function isEmailEnabled(): Promise<boolean> {
  const config = await getNotificationsConfig()
  return config.email_enabled && (config.smtp !== null || process.env.RESEND_API_KEY != null)
}

export async function isPushEnabled(): Promise<boolean> {
  const config = await getNotificationsConfig()
  return config.push_enabled
}

export async function updateNotificationsConfig(
  config: Partial<NotificationsConfig>,
): Promise<{ error?: string }> {
  const db = createAdminClientUntyped()
  const current = await getNotificationsConfig()

  const merged = {
    email_enabled: config.email_enabled ?? current.email_enabled,
    push_enabled: config.push_enabled ?? current.push_enabled,
    smtp: config.smtp !== undefined ? config.smtp : current.smtp,
  }

  const { error } = await db
    .from('app_settings')
    .upsert(
      {
        key: SETTINGS_KEY,
        value: merged as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )

  if (error) return { error: error.message }
  await cache.del(CACHE_KEY)
  return {}
}
