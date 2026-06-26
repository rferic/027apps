'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { LOCALE_LABELS } from '@/i18n/routing'
import type { AdminUser } from '@/lib/use-cases/admin/users'
import { editUserAction } from '../actions'

interface Props {
  user: AdminUser
  availableLocales: string[]
}

const initial: { error: string | null; success?: boolean } = { error: null }

export function EditUserForm({ user, availableLocales }: Props) {
  const t = useTranslations('admin.editUser')
  const boundAction = editUserAction.bind(null, user.id)
  const [state, formAction, pending] = useActionState(boundAction, initial)
  const prevStateRef = useRef(initial)

  useEffect(() => {
    if (state === prevStateRef.current) return
    prevStateRef.current = state
    if (state.success) toast.success(t('saved'))
    else if (state.error) toast.error(state.error)
  }, [state, t])

  return (
    <form action={formAction} className="space-y-5">
      <div className="bg-white border border-slate-100 rounded-xl p-5 space-y-4">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 mb-1">{t('displayName')}</label>
          <input id="displayName" name="displayName" type="text" required defaultValue={user.displayName} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">{t('email')}</label>
          <input id="email" name="email" type="email" required defaultValue={user.email} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('role')}</label>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{user.role}</span>
            <span className="text-xs text-muted-foreground">{t('roleNote')}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t('locale')}</label>
          <div className="flex gap-2 flex-wrap">
            {availableLocales.map((loc) => (
              <label key={loc} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="locale"
                  value={loc}
                  defaultChecked={user.locale === loc}
                  className="sr-only peer"
                />
                <span className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 peer-checked:bg-slate-900 peer-checked:text-white peer-checked:border-slate-900 transition-colors cursor-pointer">
                  {LOCALE_LABELS[loc] ?? loc.toUpperCase()}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{t('localeNote')}</p>
        </div>

        <div className="pt-3 border-t border-border">
          <button type="submit" disabled={pending} className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer">
            {pending ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </form>
  )
}
