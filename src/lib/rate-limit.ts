const MAX_STORE_SIZE = 10000

const store = new Map<string, { count: number; resetAt: number }>()

function cleanupStore() {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
  // LRU eviction: if still over max, delete oldest entries
  if (store.size > MAX_STORE_SIZE) {
    const entries = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
    const toDelete = entries.slice(0, store.size - MAX_STORE_SIZE)
    for (const [key] of toDelete) store.delete(key)
  }
}

/** Auto-cleanup on every 100th call */
let callCount = 0

/**
 * Extracts the real client IP from the x-forwarded-for header.
 * Vercel appends the client's real connecting IP as the last value,
 * so we take the last entry to avoid spoofing.
 */
export function getClientIp(forwardedFor: string | null): string {
  if (!forwardedFor) return 'unknown'
  const parts = forwardedFor.split(',').map((s) => s.trim())
  return parts.pop() ?? 'unknown'
}

export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): { allowed: boolean; remaining: number } {
  callCount++
  if (callCount % 100 === 0) cleanupStore()

  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxAttempts - 1 }
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: maxAttempts - entry.count }
}
