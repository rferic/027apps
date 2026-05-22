'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPasswordAction } from './actions'

interface Props {
  locale: string
}

const initialState: { success: boolean } = { success: false }

export function RecoverForm({ locale }: Props) {
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')

  const [state, formAction, pending] = useActionState(resetPasswordAction.bind(null, locale), initialState)

  if (state.success) {
    return (
      <div className="text-center">
        <p className="text-sm text-slate-600">{t('recover_success')}</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t('recover_email_label')}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 text-sm font-medium bg-slate-900 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer"
      >
        {pending ? tCommon('loading') : t('recover_submit')}
      </button>
    </form>
  )
}
