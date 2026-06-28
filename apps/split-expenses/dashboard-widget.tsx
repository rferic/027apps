'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { DollarSign, Users, Wallet, TrendingUp } from 'lucide-react'
import { DsSkeleton } from '@/components/ds/skeleton'
import { DsCard } from '@/components/ds/card'

interface WidgetStats {
  totalGroups: number
  totalExpenses: number
  totalMembers: number
  totalTransfers: number
}

export default function SplitExpensesDashboardWidget() {
  const locale = useLocale()
  const t = useTranslations('apps.split-expenses')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<WidgetStats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/v1/admin/apps/split-expenses/stats', { credentials: 'include' })
        if (res.ok) setStats(await res.json())
        else setError(true)
      } catch { setError(true) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [])

  if (loading) return <DsSkeleton height={80} />
  if (error || !stats) return null

  return (
    <DsCard padding="md" hover={false}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-emerald-500" />
          <h3 className="text-sm font-semibold text-foreground">{t('dashboard.title')}</h3>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t('dashboard.groups')}</p>
            <p className="text-lg font-bold text-foreground">{stats.totalGroups}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('dashboard.expenses')}</p>
            <p className="text-lg font-bold text-foreground">{stats.totalExpenses}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('dashboard.members')}</p>
            <p className="text-lg font-bold text-foreground">{stats.totalMembers}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('dashboard.transfers')}</p>
            <p className="text-lg font-bold text-foreground">{stats.totalTransfers}</p>
          </div>
        </div>

        <Link href={`/${locale}/admin/apps/split-expenses`}
          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
        >
          {t('dashboard.manage')} →
        </Link>
      </div>
    </DsCard>
  )
}
