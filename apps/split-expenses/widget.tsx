'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeftRight, Loader2 } from 'lucide-react'
import { useAppContext } from '@/lib/apps/context'

interface BalanceWidget {
  user_id: string
  display_name: string | null
  net_balance: number
}

function currencySymbol(code: string): string {
  const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr' }
  return symbols[code] ?? code
}

export default function SplitExpensesWidget() {
  const ctx = useAppContext()
  const locale = useLocale()
  const t = useTranslations('apps.splitExpenses')
  const [loading, setLoading] = useState(true)
  const [myBalance, setMyBalance] = useState<BalanceWidget | null>(null)
  const [totalOwed, setTotalOwed] = useState(0)
  const [totalOwes, setTotalOwes] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!ctx.groupSlug) return
    async function fetchData() {
      try {
        const res = await fetch(`/api/v1/${ctx.groupSlug}/apps/split-expenses`, { credentials: 'include' })
        if (!res.ok) { setError(true); return }

        const groups = (await res.json()).data ?? []
        let userId = ''
        const { data: { session } } = await (await import('@/lib/supabase/client')).createClient().auth.getSession()
        if (session?.user) userId = session.user.id

        let myOwed = 0
        let myOwes = 0
        for (const group of groups) {
          const balRes = await fetch(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${group.id}/balances`, { credentials: 'include' })
          if (!balRes.ok) continue
          const bal = await balRes.json()
          const me = (bal.balances ?? []).find((b: BalanceWidget) => b.user_id === userId)
          if (me) {
            if (me.net_balance > 0) myOwed += me.net_balance
            else if (me.net_balance < 0) myOwes += Math.abs(me.net_balance)
          }
        }

        setTotalOwed(myOwed)
        setTotalOwes(myOwes)
      } catch { setError(true) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [ctx.groupSlug])

  const hasData = totalOwed > 0 || totalOwes > 0

  return (
    <div className="p-4">
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : error ? (
        <p className="text-xs text-slate-400 text-center py-4">{t('widget.error')}</p>
      ) : !hasData ? (
        <div className="text-center py-4">
          <p className="text-xs text-slate-400">{t('widget.allSettled')}</p>
          <Link href={`/${locale}/${ctx.groupSlug}/apps/split-expenses`} className="text-xs text-emerald-500 hover:underline mt-1 inline-block">
            {t('widget.viewDetails')} →
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {totalOwed > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t('balance.youAreOwed')}</span>
                <span className="font-semibold text-emerald-600">{totalOwed.toFixed(2)}€</span>
              </div>
            )}
            {totalOwes > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t('balance.youOwe')}</span>
                <span className="font-semibold text-red-500">{totalOwes.toFixed(2)}€</span>
              </div>
            )}
          </div>
          <Link href={`/${locale}/${ctx.groupSlug}/apps/split-expenses`}
            className="flex items-center justify-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
          >
            <ArrowLeftRight className="w-3 h-3" /> {t('widget.viewDetails')}
          </Link>
        </>
      )}
    </div>
  )
}
