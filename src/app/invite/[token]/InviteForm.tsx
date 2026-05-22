'use client'

import { useTransition, useState } from 'react'
import { acceptInvitationAction } from './actions'

interface Props {
  token: string
  lockedEmail: string | null
  role: 'admin' | 'member'
  locale: string
  labels: {
    full_name: string
    email: string
    password: string
    your_name: string
    email_placeholder: string
    min_chars: string
    creating: string
    create_account: string
    joining_as: string
  }
}

export function InviteForm({ token, lockedEmail, role, locale, labels: l }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await acceptInvitationAction(token, formData, locale)
      if (result && 'error' in result) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
          {l.full_name}
        </label>
        <input
          name="display_name"
          type="text"
          required
          autoFocus
          placeholder={l.your_name}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
          {l.email}
        </label>
        {lockedEmail ? (
          <input
            name="email"
            type="email"
            value={lockedEmail}
            readOnly
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
          />
        ) : (
          <input
            name="email"
            type="email"
            required
            placeholder={l.email_placeholder}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
          {l.password}
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder={l.min_chars}
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
        {pending ? l.creating : l.create_account}
      </button>

      <p className="text-center text-xs text-slate-400">
        {l.joining_as} <span className="font-medium text-slate-600">{role}</span>
      </p>
    </form>
  )
}
