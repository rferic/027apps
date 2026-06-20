'use client'

import { useEffect } from 'react'

export function GroupCookieSync({ slug }: { slug: string | null }) {
  useEffect(() => {
    if (!slug) return
    document.cookie = `last_group=${slug};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`
  }, [slug])

  return null
}
