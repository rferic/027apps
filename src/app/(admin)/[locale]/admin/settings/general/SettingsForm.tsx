'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ALL_LOCALES } from '@/lib/use-cases/settings'
import { updateSettingsAction, type SettingsState } from './actions'

interface Props {
  activeLocales: string[]
  defaultLocale: string
}

const initial: SettingsState = { error: null }

export function SettingsForm({ activeLocales, defaultLocale }: Props) {
  const t = useTranslations('admin.settings.general')
  const [state, formAction, pending] = useActionState(updateSettingsAction, initial)
  const prevStateRef = useRef(initial)

  useEffect(() => {
    if (state === prevStateRef.current) return
    prevStateRef.current = state
    if (state.success) toast.success(t('saved'))
    else if (state.error) toast.error(state.error === 'atLeastOne' ? t('atLeastOne') : state.error)
  }, [state, t])

  return (
    <form action={formAction} className="space-y-6 max-w-xl">
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">{t('languages')}</label>
          <p className="text-xs text-muted-foreground mb-3">{t('languagesHelp')}</p>
          <div className="flex flex-wrap gap-2">
            {ALL_LOCALES.map((loc) => (
              <label key={loc} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name={`locale_${loc}`}
                  defaultChecked={activeLocales.includes(loc)}
                  className="sr-only peer"
                />
                <span className="px-3 py-1.5 rounded-lg text-sm border border-border peer-checked:bg-foreground peer-checked:text-white peer-checked:border-slate-900 transition-colors cursor-pointer">
                  {t(`localeNames.${loc}`)}
                  <span className="ml-1.5 opacity-60">{loc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <label className="block text-sm font-semibold text-foreground mb-1">{t('defaultLocale')}</label>
          <p className="text-xs text-muted-foreground mb-3">{t('defaultLocaleHelp')}</p>
          <select
            name="default_locale"
            defaultValue={defaultLocale}
            className="w-full max-w-xs px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-card cursor-pointer"
          >
            {ALL_LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {t(`localeNames.${loc}`)} ({loc})
              </option>
            ))}
          </select>
        </div>

        <div className="pt-3 border-t border-border">
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 bg-foreground text-white text-sm font-medium rounded-lg hover:bg-foreground transition-colors disabled:opacity-50 cursor-pointer"
          >
            {pending ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </form>
  )
}
