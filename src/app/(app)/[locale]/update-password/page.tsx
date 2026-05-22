'use client'

import { use, useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Props = { params: Promise<{ locale: string }> }

export default function UpdatePasswordPage({ params }: Props) {
  const { locale } = use(params)
  const t = useTranslations('auth')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pageState, setPageState] = useState<'loading' | 'invalid_link' | 'ready'>('loading')

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) {
      queueMicrotask(() => setPageState('invalid_link'))
      return
    }

    const params = new URLSearchParams(hash.substring(1))
    const accessToken = params.get('access_token') || params.get('access_token%3D')

    if (!accessToken) {
      queueMicrotask(() => setPageState('invalid_link'))
      return
    }

    const supabase = createClient()
    supabase.auth.setSession({ access_token: accessToken, refresh_token: '' }).then(({ error: sessionError }) => {
      setPageState(sessionError ? 'invalid_link' : 'ready')
    })
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const confirm = formData.get('confirm_password') as string

    if (password.length < 8) {
      setError(t('password_min_length'))
      return
    }
    if (password !== confirm) {
      setError(t('password_mismatch'))
      return
    }

    startTransition(async () => {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess(true)
      }
    })
  }

  if (pageState === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-400">{t('updating')}</p>
      </div>
    )
  }

  if (pageState === 'invalid_link') {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-sm text-slate-600">{t('invalid_reset_link')}</p>
            <Link
              href={`/${locale}/recover`}
              className="mt-4 inline-block text-sm text-slate-900 hover:text-slate-700 underline underline-offset-4"
            >
              {t('recover_submit')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-sm text-slate-600">{t('password_updated')}</p>
            <Link
              href={`/${locale}/login?reset=success`}
              className="mt-4 inline-block text-sm text-slate-900 hover:text-slate-700 underline underline-offset-4"
            >
              {t('go_to_dashboard')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-icon.svg" alt="027Apps" width={56} height={56} className="mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">027Apps</h1>
          <p className="text-sm text-slate-400 mt-1">{t('update_password_title')}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                {t('new_password')}
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder={t('password_min_length')}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                {t('confirm_password')}
              </label>
              <input
                name="confirm_password"
                type="password"
                required
                minLength={8}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full py-2.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {pending ? t('updating') : t('update_password_submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
