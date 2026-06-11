'use client'

import { useOptimistic, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { updateAppVisibilityAction, grantAppAccessAction, revokeAppAccessAction } from '@/lib/apps/actions'

interface GroupAccess {
  groupId: string
  groupName: string
  groupSlug: string
  hasAccess: boolean
}

interface Props {
  slug: string
  visibility: 'public' | 'private'
  groups: GroupAccess[]
}

export function AdminAppPermissions({ slug, visibility: initialVisibility, groups: initialGroups }: Props) {
  const t = useTranslations('apps')
  const tc = useTranslations('common')
  const [visibilityPending, startVisibilityTransition] = useTransition()
  const [optimisticVisibility, updateOptimisticVisibility] = useOptimistic(initialVisibility)
  const [optimisticGroups, updateOptimistic] = useOptimistic(
    initialGroups,
    (state, { groupId, hasAccess }: { groupId: string; hasAccess: boolean }) =>
      state.map(g => g.groupId === groupId ? { ...g, hasAccess } : g)
  )
  const [accessPending, startAccessTransition] = useTransition()

  function handleVisibilityChange(newVisibility: 'public' | 'private') {
    startVisibilityTransition(async () => {
      updateOptimisticVisibility(newVisibility)
      const result = await updateAppVisibilityAction(slug, newVisibility)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(t('permissions.visibility_updated'))
      }
    })
  }

  function handleToggleAccess(groupId: string, currentAccess: boolean) {
    const newAccess = !currentAccess
    startAccessTransition(async () => {
      updateOptimistic({ groupId, hasAccess: newAccess })
      const result = newAccess
        ? await grantAppAccessAction(slug, groupId)
        : await revokeAppAccessAction(slug, groupId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(newAccess ? t('permissions.access_granted') : t('permissions.access_revoked'))
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={visibilityPending}
          onClick={() => handleVisibilityChange('public')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            optimisticVisibility === 'public'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
          }`}
        >
          {t('permissions.visibility_public')}
        </button>
        <button
          type="button"
          disabled={visibilityPending}
          onClick={() => handleVisibilityChange('private')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            optimisticVisibility === 'private'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
          }`}
        >
          {t('permissions.visibility_private')}
        </button>
      </div>

      {optimisticVisibility === 'public' ? (
        <p className="text-sm text-slate-500">{t('permissions.visibility_description_public')}</p>
      ) : (
        <div className="space-y-2">
          {optimisticGroups.length === 0 ? (
            <p className="text-sm text-slate-500">{tc('noGroups')}</p>
          ) : (
            optimisticGroups.map(group => (
              <div key={group.groupId} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50">
                <div>
                  <span className="text-sm font-medium text-slate-700">{group.groupName}</span>
                  <span className="text-xs text-slate-400 ml-2">{group.groupSlug}</span>
                </div>
                <button
                  type="button"
                  disabled={accessPending}
                  onClick={() => handleToggleAccess(group.groupId, group.hasAccess)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                    group.hasAccess
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {group.hasAccess ? t('permissions.revoke_access') : t('permissions.grant_access')}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
