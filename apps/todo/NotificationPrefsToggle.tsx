'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Bell, BellOff } from 'lucide-react'
import { toast } from 'sonner'

export default function NotificationPrefsToggle() {
  const t = useTranslations('apps.todo')
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/admin/apps/todo/notification-prefs').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/v1/admin/users').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([prefsData, usersData]) => {
      const prefs: any[] = Array.isArray(prefsData) ? prefsData : (prefsData?.data ?? [])
      const allOn = prefs.length === 0 || prefs.every(p => p.on_assigned && p.on_status_change)
      setEnabled(allOn)
      setLoading(false)
    }).catch(() => { setLoading(false) })
  }, [])

  async function toggle() {
    const newVal = !enabled
    setSaving(true)
    const res = await fetch('/api/v1/admin/apps/todo/notification-prefs/bulk', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on_assigned: newVal, on_status_change: newVal }),
    })
    setSaving(false)
    if (res.ok) {
      setEnabled(newVal)
      toast.success(newVal ? 'Notifications enabled for all users' : 'Notifications disabled for all users')
    } else {
      toast.error('Failed to update')
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-4">Email notifications</h3>
      <div className="flex items-center justify-between py-3 px-4 bg-muted rounded-lg">
        <div className="flex items-center gap-3">
          {enabled ? <Bell size={18} className="text-indigo-500" /> : <BellOff size={18} className="text-muted-foreground" />}
          <div>
            <p className="text-sm font-medium text-foreground">{enabled ? 'Notifications enabled' : 'Notifications disabled'}</p>
            <p className="text-xs text-muted-foreground">Affects all users — assigned and status change emails</p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-muted'} ${saving ? 'opacity-50' : ''}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    </div>
  )
}
