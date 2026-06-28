import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { cache } from '@/lib/redis'

const EMAIL_CACHE_TTL = 3600

export async function getUserEmailMap(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()

  const map = new Map<string, string>()
  const toFetch: string[] = []

  for (const id of userIds) {
    const cached = await cache.get<string>(`email:${id}`)
    if (cached) { map.set(id, cached); continue }
    toFetch.push(id)
  }

  if (toFetch.length === 0) return map

  const supabase = createAdminClientUntyped()
  const targetSet = new Set(toFetch)

  let page = 1
  const perPage = 500
  while (targetSet.size > 0) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage })
    if (!data?.users?.length) break

    for (const user of data.users) {
      if (targetSet.has(user.id) && user.email) {
        map.set(user.id, user.email)
        targetSet.delete(user.id)
        cache.set(`email:${user.id}`, user.email, EMAIL_CACHE_TTL).catch(() => {})
      }
    }
    if (data.users.length < perPage) break
    page++
  }

  return map
}
