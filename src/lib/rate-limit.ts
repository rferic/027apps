const store = new Map<string, { count: number; resetAt: number }>()

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
