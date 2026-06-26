'use client'

import { useOptimistic, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { grantGroupAppAccessAction, revokeGroupAppAccessAction } from '@/lib/apps/access'

interface AppAccess {
  slug: string
  hasAccess: boolean
}

interface Props {
  groupId: string
  apps: AppAccess[]
}

export function GroupAppsSection({ groupId, apps: initialApps }: Props) {
  const t = useTranslations('admin')
  const [pending, startTransition] = useTransition()
  const [optimisticApps, updateOptimistic] = useOptimistic(
    initialApps,
    (state, { slug, hasAccess }: { slug: string; hasAccess: boolean }) =>
      state.map(a => a.slug === slug ? { ...a, hasAccess } : a)
  )

  function handleToggle(slug: string, currentAccess: boolean) {
    const newAccess = !currentAccess
    startTransition(async () => {
      updateOptimistic({ slug, hasAccess: newAccess })
      const result = newAccess
        ? await grantGroupAppAccessAction(groupId, slug)
        : await revokeGroupAppAccessAction(groupId, slug)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success(newAccess ? t('groups.access_granted') : t('groups.access_revoked'))
      }
    })
  }

  if (initialApps.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('groups.apps_empty')}</p>
  }

  return (
    <div className="space-y-1">
      {optimisticApps.map(app => (
        <div key={app.slug} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50">
          <span className="text-sm font-medium text-foreground">{app.slug}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => handleToggle(app.slug, app.hasAccess)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
              app.hasAccess
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {app.hasAccess ? t('groups.app_access_enabled') : t('groups.app_access_disabled')}
          </button>
        </div>
      ))}
    </div>
  )
}
