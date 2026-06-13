'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Pencil, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'

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
        <h2 className="text-lg font-bold text-slate-900">{t('title')}</h2>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchPlaceholder')}
            className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-sm text-slate-400">{t('empty')}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(g => (
            <div key={g.id} className="border border-slate-100 rounded-xl overflow-hidden">
              <button onClick={() => toggleGroup(g.id)}
                className="w-full flex items-center gap-3 p-3 bg-white hover:bg-slate-50 transition-colors text-left"
              >
                <span className="text-xl">{g.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{g.title}</p>
                  <p className="text-xs text-slate-400">{t('groupLabel', { id: g.group_id?.slice(0, 8) ?? '', currency: g.currency })}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); handleDeleteGroup(g.id) }} className="p-1 text-slate-300 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </button>

              {expandedGroup === g.id && (
                <div className="border-t border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500 mb-2">{t('expensesLabel')}</p>
                  {!expenses[g.id] ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                  ) : expenses[g.id].length === 0 ? (
                    <p className="text-xs text-slate-400">{t('noExpenses')}</p>
                  ) : (
                    <div className="space-y-1">
                      {expenses[g.id].map(e => (
                        <div key={e.id} className="flex items-center justify-between p-2 bg-white rounded border border-slate-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className={`text-xs ${e.settled ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{e.title}</p>
                            {e.settled && <span className="text-[10px] text-slate-300">{t('settledBadge')}</span>}
                          </div>
                          <span className="text-xs font-medium text-slate-600">{g.currency} {Number(e.amount).toFixed(2)}</span>
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
