import { createAdminClientUntyped } from '@/lib/supabase/admin'

const RELOAD_DELAY_MS = 150

export async function reloadSchemaCache(): Promise<void> {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({ sql: "notify pgrst, 'reload schema'" }),
    })
  } catch {
    // best-effort
  }
  await new Promise(resolve => setTimeout(resolve, RELOAD_DELAY_MS))
}

export async function withSchemaCacheRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (err) {
      lastError = err
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('schema cache') && !message.includes('PGRST')) throw err

      if (attempt < maxRetries) {
        await reloadSchemaCache()
        await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, attempt)))
      }
    }
  }

  throw lastError
}
