'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface UserPref {
  user_id: string
  display_name: string
  on_assigned: boolean
  on_status_change: boolean
}

export default function NotificationPrefsToggle({ groupSlug }: { groupSlug?: string }) {
  const t = useTranslations('apps.todo')
  const [users, setUsers] = useState<UserPref[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const base = groupSlug ? `/api/v1/${groupSlug}/apps/todo` : '/api/v1/admin/apps/todo'
    Promise.all([
      fetch(`${base}/notification-prefs`).then(r => r.json()).catch(() => ({ data: [] })),
      groupSlug
        ? fetch(`/api/v1/${groupSlug}/members`, { credentials: 'include' }).then(r => r.json()).catch(() => [])
        : fetch('/api/v1/admin/users').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([prefsData, usersData]) => {
      const prefs: any[] = Array.isArray(prefsData) ? prefsData : (prefsData?.data ?? [])
      const userList: any[] = Array.isArray(usersData) ? usersData : (usersData?.data ?? [])
      const prefMap = new Map(prefs.map((p: any) => [p.user_id, p]))
      const result: UserPref[] = userList.map((u: any) => {
        const pref = prefMap.get(u.id || u.user_id)
        return {
          user_id: u.id || u.user_id,
          display_name: u.display_name || u.displayName || u.email || u.id?.slice(0, 8),
          on_assigned: pref ? !!pref.on_assigned : true,
          on_status_change: pref ? !!pref.on_status_change : true,
        }
      })
      setUsers(result)
      setLoading(false)
    }).catch(() => { setLoading(false); toast.error('Failed to load users') })
  }, [groupSlug])

  async function toggleUser(userId: string, key: 'on_assigned' | 'on_status_change', value: boolean) {
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, [key]: value } : u))
    const base = groupSlug ? `/api/v1/${groupSlug}/apps/todo` : '/api/v1/admin/apps/todo'
    const res = await fetch(`${base}/notification-prefs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, [key]: value }),
    })
    if (!res.ok) toast.error('Failed to update')
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-200" /></div>

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Notification preferences</h3>
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.user_id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-700">{u.display_name}</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" checked={u.on_assigned} onChange={e => toggleUser(u.user_id, 'on_assigned', e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                Assigned
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" checked={u.on_status_change} onChange={e => toggleUser(u.user_id, 'on_status_change', e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                Status
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
