'use client'

import { useTransition } from 'react'
import { signOut, signOutAdmin } from '@/lib/auth/actions'

interface Props {
  variant: 'app' | 'admin'
  locale?: string
  label: string
}

export function LogoutButton({ variant, locale = 'en', label }: Props) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      if (variant === 'admin') await signOutAdmin()
      else await signOut(locale)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-muted-foreground hover:text-slate-200 transition-colors disabled:opacity-50"
    >
      {pending ? '…' : label}
    </button>
  )
}
