'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { install } from './actions'
import { installT, type InstallLocale } from './translations'

const LOCALES: { value: InstallLocale; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
  { value: 'it', label: 'IT' },
]

function setPreferredLocaleCookie(locale: InstallLocale) {
  document.cookie = `preferred-locale=${locale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`
}

function getInitialLocale(): InstallLocale {
  const match = document.cookie.match(/preferred-locale=([^;]+)/)
  const saved = match?.[1] as InstallLocale | undefined
  if (saved && saved in installT) return saved
  return 'en'
}

export function InstallForm() {
  const [locale, setLocale] = useState<InstallLocale>('en')
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const t = installT[locale]

  useEffect(() => {
    setMounted(true)
    const cookieLocale = getInitialLocale()
    if (cookieLocale !== 'en') setLocale(cookieLocale)
  }, [])

  function handleLocaleChange(newLocale: InstallLocale) {
    setLocale(newLocale)
    setPreferredLocaleCookie(newLocale)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)

    if (form.get('password') !== form.get('confirm_password')) {
      setError(t.passwordMismatch)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await install(form)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
        return
      }
      setRedirecting(true)
    } catch (err) {
      const isRedirect =
        err instanceof Error &&
        (err.message.includes('NEXT_REDIRECT') ||
          (err as Error & { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))
      if (isRedirect) {
        setRedirecting(true)
        return
      }
      setError(err instanceof Error ? err.message : 'Unexpected error')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-4">
          <div className="flex gap-1">
            {LOCALES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleLocaleChange(value)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  locale === value
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center mb-8">
          <Image src="/logo-icon.svg" alt="027Apps" width={56} height={56} className="mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>
          <p className="text-sm text-slate-400 mt-1 text-center">{t.subtitle}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">{t.yourName}</Label>
              <Input id="display_name" name="display_name" type="text" required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group_name">{t.groupName}</Label>
              <Input id="group_name" name="group_name" type="text" required placeholder={t.groupNamePlaceholder} />
            </div>
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t.email}</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t.password}</Label>
                <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">{t.confirmPassword}</Label>
                <Input id="confirm_password" name="confirm_password" type="password" required minLength={8} autoComplete="new-password" />
              </div>
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            {redirecting ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 className="size-8 text-emerald-500" />
                <p className="text-sm text-slate-500">{t.redirecting}</p>
              </div>
            ) : (
              <Button
                type="submit"
                className="w-full bg-[#9B1C1C] hover:bg-[#7F1D1D] text-white"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {t.creating}
                  </span>
                ) : (
                  t.submit
                )}
              </Button>
            )}
          </form>
        </div>

        <p className="text-xs text-slate-400 text-center mt-6">{t.footer}</p>
      </div>
    </div>
  )
}
