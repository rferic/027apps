'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { DsButton } from '@/components/ds/button'
import { DsCard } from '@/components/ds/card'
import { DsSkeleton } from '@/components/ds/skeleton'
import { DsEmptyState } from '@/components/ds/empty-state'
import { DsBadge } from '@/components/ds/badge'

interface Group {
  id: string; title: string; emoji: string; currency: string;
  group_id: string; created_by: string; created_at: string;
}

interface Expense {
  id: string; expense_group_id: string; title: string;
  amount: number; paid_by: string; settled: boolean; created_at: string;
}

export default function SplitExpensesAdmin() {
  const t = useTranslations('admin.splitExpenses')
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<Record<string, Expense[]>>({})
  const [refresh, setRefresh] = useState(0)

  async function fetchAllGroups() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/admin/apps/split-expenses')
      if (res.ok) {
        const data = await res.json()
        setGroups(Array.isArray(data) ? data : data?.data ?? [])
      }
    } catch { toast.error(t('loadError')) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAllGroups() }, [refresh])

  async function fetchExpensesForGroup(groupId: string) {
    try {
      const res = await fetch(`/api/v1/admin/apps/split-expenses/expenses?expense_group_id=${groupId}`)
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : data?.data ?? []
        setExpenses(prev => ({ ...prev, [groupId]: list }))
      }
    } catch {}
  }

  function toggleGroup(groupId: string) {
    if (expandedGroup === groupId) {
      setExpandedGroup(null)
    } else {
      setExpandedGroup(groupId)
      if (!expenses[groupId]) fetchExpensesForGroup(groupId)
    }
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm(t('deleteConfirm'))) return
    const res = await fetch(`/api/v1/admin/apps/split-expenses?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(t('deleted')); setRefresh(r => r + 1) }
    else toast.error(t('deleteError'))
  }

  const filtered = groups.filter(g => !search || g.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{t('title')}</h2>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchPlaceholder')}
            className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-card text-foreground"
          />
        </div>
      </div>

      {loading ? (
        <DsSkeleton height={48} count={5} />
      ) : filtered.length === 0 ? (
        <DsEmptyState title={t('empty')} />
      ) : (
        <div className="space-y-2">
          {filtered.map(g => (
            <div key={g.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
              <DsCard padding="sm" hover onClick={() => toggleGroup(g.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{g.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{g.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>{t('groupLabel', { id: g.group_id?.slice(0, 8) ?? '', currency: g.currency })}</p>
                  </div>
                  <span onClick={e => { e.stopPropagation(); handleDeleteGroup(g.id) }}>
                    <DsButton variant="ghost" size="sm" style={{ color: '#EF4444' }}><Trash2 className="w-3.5 h-3.5" /></DsButton>
                  </span>
                </div>
              </DsCard>

              {expandedGroup === g.id && (
                <div style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-muted)', padding: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>{t('expensesLabel')}</p>
                  {!expenses[g.id] ? (
                    <DsSkeleton height={20} />
                  ) : expenses[g.id].length === 0 ? (
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{t('noExpenses')}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {expenses[g.id].map(e => (
                        <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <p style={{ fontSize: 11, color: e.settled ? 'var(--color-text-secondary)' : 'var(--color-text)', textDecoration: e.settled ? 'line-through' : 'none', margin: 0 }}>{e.title}</p>
                            {e.settled && <DsBadge variant="neutral" style={{ fontSize: 9 }}>{t('settledBadge')}</DsBadge>}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text)' }}>{g.currency} {Number(e.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
