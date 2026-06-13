'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useAppContext } from '@/lib/apps/context'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Loader2, Pencil, Trash2, Check, Users, BarChart3, Tags, ArrowLeftRight, ChevronDown, Filter } from 'lucide-react'

const supabase = createClient()
let cachedToken: string | null = null

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  if (cachedToken) {
    const h: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}), Authorization: `Bearer ${cachedToken}` }
    return fetch(url, { ...options, headers: h, credentials: 'include' })
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) cachedToken = session.access_token
  const h: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) }
  if (cachedToken) h['Authorization'] = `Bearer ${cachedToken}`
  return fetch(url, { ...options, headers: h, credentials: 'include' })
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr', CAD: 'C$', AUD: 'A$',
  BRL: 'R$', CNY: '¥', INR: '₹', KRW: '₩', MXN: 'Mex$', RUB: '₽', SEK: 'kr',
  NOK: 'kr', DKK: 'kr', PLN: 'zł', TRY: '₺', ZAR: 'R', SGD: 'S$', HKD: 'HK$',
  NZD: 'NZ$', THB: '฿', ILS: '₪', CLP: 'CLP$', PHP: '₱', AED: 'د.إ',
  MYR: 'RM', COP: 'COL$', PEN: 'S/', CRC: '₡', UYU: '$U', VND: '₫',
  PKR: '₨', KZT: '₸', UAH: '₴', TWD: 'NT$', ARS: 'AR$',
}

function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code
}

function formatAmount(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${amount.toFixed(2)}`
}

const EMOJIS = ['💰', '🏖️', '🍕', '🎉', '🛒', '🏠', '🚗', '✈️', '🎁', '🍺', '☕', '🎬', '🏋️', '👕', '📚', '🐕', '🌺', '🏨', '⚽', '🎸', '🍷', '🌮', '🍦', '👶', '🎵']

function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {EMOJIS.map(e => (
        <button key={e} type="button" onClick={() => onChange(e)}
          className={`w-8 h-8 text-lg flex items-center justify-center rounded-lg border ${value === e ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-slate-300'}`}
        >{e}</button>
      ))}
    </div>
  )
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── SVG Chart ──────────────────────────────────────────────────────────

function SpendingChart({ data, cumulative, period }: { data: { label: string; total: number }[]; cumulative: boolean; period: string }) {
  const displayData = cumulative ? data.reduce<{ label: string; total: number }[]>((acc, d) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].total : 0
    acc.push({ label: d.label, total: prev + d.total })
    return acc
  }, []) : data

  if (displayData.length === 0) return null
  const maxVal = Math.max(...displayData.map(d => d.total), 1)
  const w = 600
  const h = 200
  const pad = { top: 10, right: 10, bottom: 25, left: 50 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom
  const barW = chartW / displayData.length * 0.7
  const gap = chartW / displayData.length * 0.3

  const points = displayData.map((d, i) => {
    const x = pad.left + (chartW / displayData.length) * i + (chartW / displayData.length) / 2
    const y = pad.top + chartH - (d.total / maxVal) * chartH
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ maxHeight: 220 }}>
      {displayData.map((d, i) => {
        const x = pad.left + (chartW / displayData.length) * i
        const barH = (d.total / maxVal) * chartH
        return (
          <g key={i}>
            <rect x={x + gap / 2} y={pad.top + chartH - barH} width={barW} height={barH} rx={2} fill="#10B981" opacity={0.7} />
            {i % Math.ceil(displayData.length / 8) === 0 && (
              <text x={x + barW / 2 + gap / 2} y={h - 5} textAnchor="end" fontSize={9} fill="#94A3B8" transform={`rotate(-45, ${x + barW / 2 + gap / 2}, ${h - 5})`}>
                {period === 'day' ? d.label.slice(5) : d.label}
              </text>
            )}
          </g>
        )
      })}
      <polyline points={points} fill="none" stroke="#059669" strokeWidth={2} />
      {displayData.map((d, i) => {
        const x = pad.left + (chartW / displayData.length) * i + (chartW / displayData.length) / 2
        const y = pad.top + chartH - (d.total / maxVal) * chartH
        return <circle key={i} cx={x} cy={y} r={3} fill="#059669" />
      })}
    </svg>
  )
}

// ─── Types ──────────────────────────────────────────────────────────────

interface ExpenseGroup {
  id: string; title: string; emoji: string; currency: string;
  created_by: string; created_at: string; member_count?: number;
}

interface GroupDetail extends ExpenseGroup {
  members: Member[]
}

interface Member {
  id: string; expense_group_id: string; user_id: string; active: boolean;
  display_name: string | null; avatar_url: string | null; created_at: string;
}

interface Expense {
  id: string; expense_group_id: string; title: string; amount: number;
  paid_by: string; tag_id: string | null; settled: boolean;
  created_by: string; created_at: string;
  paid_by_profile?: { display_name: string | null } | null;
  shares?: Share[]
}

interface Share {
  id: string; expense_id: string; user_id: string; amount: number;
  user_profile?: { display_name: string | null } | null;
}

interface Tag { id: string; expense_group_id: string; name: string; color: string; }

interface Balance { user_id: string; display_name: string | null; net_balance: number; }
interface Transfer { from_user: string; to_user: string; from_name: string | null; to_name: string | null; amount: number; }

// ─── Main View ──────────────────────────────────────────────────────────

export default function SplitExpensesView() {
  const ctx = useAppContext()
  const locale = useLocale()
  const t = useTranslations('apps.split-expenses')

  const [groups, setGroups] = useState<ExpenseGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)

  async function fetchGroups() {
    if (!ctx.groupSlug) return
    setLoading(true)
    try {
      const res = await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses`)
      if (res.ok) {
        const result = await res.json()
        setGroups(result.data ?? [])
      }
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchGroups() }, [ctx.groupSlug])

  if (selectedGroup) {
    return <GroupDetailView groupId={selectedGroup} onBack={() => { setSelectedGroup(null); fetchGroups() }} />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-slate-900">{t('group.list.title')}</h1>
        <button onClick={() => setShowCreateGroup(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
        ><Plus className="w-4 h-4" /> {t('group.create.title')}</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-slate-400 mb-2">{t('group.list.empty')}</p>
          <button onClick={() => setShowCreateGroup(true)}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >{t('group.list.createFirst')}</button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <button key={g.id} onClick={() => setSelectedGroup(g.id)}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-left"
            >
              <span className="text-2xl">{g.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{g.title}</p>
                <p className="text-xs text-slate-400">{t('group.list.memberCount', { count: g.member_count ?? 0 })} · {currencySymbol(g.currency)}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      <CreateGroupModal open={showCreateGroup} onClose={() => setShowCreateGroup(false)} onCreated={() => { setShowCreateGroup(false); fetchGroups() }} />
    </div>
  )
}

// ─── Create Group Modal ─────────────────────────────────────────────────

function CreateGroupModal({ open, onClose, onCreated, editGroup }: { open: boolean; onClose: () => void; onCreated: () => void; editGroup?: GroupDetail }) {
  const ctx = useAppContext()
  const t = useTranslations('apps.split-expenses')
  const [title, setTitle] = useState(editGroup?.title ?? '')
  const [emoji, setEmoji] = useState(editGroup?.emoji ?? '💰')
  const [currency, setCurrency] = useState(editGroup?.currency ?? 'EUR')
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState<string[]>([])
  const [groupMembers, setGroupMembers] = useState<{ id: string; display_name: string }[]>([])

  useEffect(() => {
    if (!open) return
    async function load() {
      if (!ctx.groupSlug) return
      try {
        const res = await fetchWithAuth(`/api/v1/${ctx.groupSlug}/members`)
        if (res.ok) {
          const data = await res.json()
          const list = Array.isArray(data) ? data : data?.data ?? []
          setGroupMembers(list.map((m: { user_id: string; display_name?: string }) => ({ id: m.user_id, display_name: m.display_name ?? t('common.unknown') })))
        }
      } catch {}
    }
    load()
    if (!editGroup) { setTitle(''); setEmoji('💰'); setCurrency('EUR'); setMembers([]) }
  }, [open, ctx.groupSlug, editGroup])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !ctx.groupSlug) return
    setSaving(true)
    try {
      if (editGroup) {
        await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${editGroup.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), emoji, currency }),
        })
      } else {
        await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), emoji, currency, members }),
        })
      }
      onCreated()
    } catch {} finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={editGroup ? t('group.create.editTitle') : t('group.create.title')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('group.create.name')}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('group.create.name')} required maxLength={100}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">{t('group.create.emoji')}</label>
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('group.create.currency')}</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            {Object.entries(CURRENCY_SYMBOLS).sort().map(([code, sym]) => (
              <option key={code} value={code}>{code} ({sym})</option>
            ))}
          </select>
        </div>
        {!editGroup && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('group.create.members')}</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {groupMembers.map(m => (
                <label key={m.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer">
                  <input type="checkbox" checked={members.includes(m.id)} onChange={e => setMembers(e.target.checked ? [...members, m.id] : members.filter(id => id !== m.id))}
                    className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
                  />
                  <span className="text-sm text-slate-700">{m.display_name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">{t('group.create.cancel')}</button>
          <button type="submit" disabled={saving || !title.trim()}
            className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >{saving && <Loader2 className="w-3 h-3 animate-spin" />}{editGroup ? t('group.create.save') : t('group.create.create')}</button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Group Detail ───────────────────────────────────────────────────────

const TABS = ['expenses', 'balances', 'members', 'stats'] as const

function GroupDetailView({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const ctx = useAppContext()
  const t = useTranslations('apps.split-expenses')
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<typeof TABS[number]>('expenses')
  const [showEditGroup, setShowEditGroup] = useState(false)

  const [fetchError, setFetchError] = useState(false)

  async function fetchGroup() {
    if (!ctx.groupSlug) { setLoading(false); return }
    setLoading(true)
    setFetchError(false)
    try {
      const res = await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}`)
      if (res.ok) setGroup(await res.json())
      else setFetchError(true)
    } catch { setFetchError(true) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchGroup() }, [groupId, ctx.groupSlug])

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
  }

  if (fetchError || !group) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-slate-400 mb-4">{t('group.detail.noGroup')}</p>
        <button onClick={onBack} className="text-sm text-emerald-600 hover:underline">{t('common.back')}</button>
      </div>
    )
  }

  return (
    <div>
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 transition-colors">
        <ChevronDown className="w-4 h-4 rotate-90" /> {t('common.back')}
      </button>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">{group.emoji}</span>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">{group.title}</h1>
          <p className="text-xs text-slate-400">{currencySymbol(group.currency)} · {t('group.detail.memberCount', { count: group.members?.length ?? 0 })}</p>
        </div>
        <button onClick={() => setShowEditGroup(true)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-100">
        {TABS.map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === tabKey ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >{t(`group.detail.tabs.${tabKey}` as any)}</button>
        ))}
      </div>

      {tab === 'expenses' && <ExpensesTab groupId={groupId} group={group} />}
      {tab === 'balances' && <BalancesTab groupId={groupId} group={group} />}
      {tab === 'members' && <MembersTab groupId={groupId} group={group} onUpdate={fetchGroup} />}
      {tab === 'stats' && <StatsTab groupId={groupId} />}

      {showEditGroup && <CreateGroupModal open={showEditGroup} onClose={() => setShowEditGroup(false)} onCreated={() => { setShowEditGroup(false); fetchGroup() }} editGroup={group} />}
    </div>
  )
}

// ─── Expenses Tab ───────────────────────────────────────────────────────

function ExpensesTab({ groupId, group }: { groupId: string; group: GroupDetail }) {
  const ctx = useAppContext()
  const locale = useLocale()
  const t = useTranslations('apps.split-expenses')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null)
  const [filterTag, setFilterTag] = useState('')
  const [filterPaidBy, setFilterPaidBy] = useState('')
  const [refresh, setRefresh] = useState(0)

  async function fetchData() {
    if (!ctx.groupSlug) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterTag) params.set('tag_id', filterTag)
      if (filterPaidBy) params.set('paid_by', filterPaidBy)
      params.set('settled', 'false')
      const res = await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/expenses?${params}`)
      if (res.ok) {
        const result = await res.json()
        setExpenses(result.data ?? [])
      }
      const tagRes = await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/tags`)
      if (tagRes.ok) setTags(await tagRes.json())
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [groupId, ctx.groupSlug, filterTag, filterPaidBy, refresh])

  const activeMembers = group.members?.filter(m => m.active) ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex gap-2">
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white">
            <option value="">{t('expense.list.allTags')}</option>
            {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
          <select value={filterPaidBy} onChange={e => setFilterPaidBy(e.target.value)} className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white">
            <option value="">{t('expense.list.allUsers')}</option>
            {group.members?.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name ?? t('common.unknown')}</option>)}
          </select>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
        ><Plus className="w-3.5 h-3.5" /> {t('expense.create.title')}</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">{t('expense.list.empty')}</div>
      ) : (
        <div className="space-y-2">
          {expenses.map(e => {
            const tag = tags.find(t => t.id === e.tag_id)
            return (
              <div key={e.id} className={`flex items-center gap-3 p-3 rounded-lg border ${e.settled ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-100'} hover:border-slate-200 transition-colors`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${e.settled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{e.title}</p>
                    {tag && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: tag.color + '20', color: tag.color }}>{tag.name}</span>}
                  </div>
                  <p className="text-xs text-slate-400">
                    {e.paid_by_profile?.display_name ?? t('common.unknown')} {t('expense.item.paidBy')} · {new Date(e.created_at).toLocaleDateString(locale)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${e.settled ? 'text-slate-300' : 'text-slate-900'}`}>{formatAmount(e.amount, group.currency)}</p>
                </div>
                {!e.settled && (
                  <div className="flex gap-1">
                    <button onClick={() => setEditExpense(e)} className="p-1 text-slate-300 hover:text-slate-500 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteExpense(e)} className="p-1 text-slate-300 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ExpenseModal open={showCreate || !!editExpense} onClose={() => { setShowCreate(false); setEditExpense(null) }}
        onSaved={() => { setShowCreate(false); setEditExpense(null); setRefresh(r => r + 1) }}
        groupId={groupId} members={activeMembers} tags={tags} currency={group.currency} editExpense={editExpense} />

      <DeleteConfirm open={!!deleteExpense} onClose={() => setDeleteExpense(null)}
        onDeleted={() => { setDeleteExpense(null); setRefresh(r => r + 1) }}
        groupId={groupId} expense={deleteExpense} />
    </div>
  )
}

// ─── Expense Modal ──────────────────────────────────────────────────────

function ExpenseModal({ open, onClose, onSaved, groupId, members, tags, currency, editExpense }: {
  open: boolean; onClose: () => void; onSaved: () => void;
  groupId: string; members: Member[]; tags: Tag[]; currency: string; editExpense?: Expense | null;
}) {
  const ctx = useAppContext()
  const t = useTranslations('apps.split-expenses')
  const [title, setTitle] = useState(editExpense?.title ?? '')
  const [amount, setAmount] = useState(editExpense?.amount?.toString() ?? '')
  const [paidBy, setPaidBy] = useState(editExpense?.paid_by ?? '')
  const [participants, setParticipants] = useState<string[]>(editExpense?.shares?.map(s => s.user_id) ?? [])
  const [tagId, setTagId] = useState(editExpense?.tag_id ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(editExpense?.title ?? '')
    setAmount(editExpense?.amount?.toString() ?? '')
    setPaidBy(editExpense?.paid_by ?? '')
    setParticipants(editExpense?.shares?.map(s => s.user_id) ?? [])
    setTagId(editExpense?.tag_id ?? '')
  }, [open, editExpense])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !amount || !paidBy || participants.length === 0 || !ctx.groupSlug) return
    setSaving(true)
    try {
      const body = { title: title.trim(), amount: parseFloat(amount), paid_by: paidBy, participant_ids: participants, tag_id: tagId || null }
      if (editExpense) {
        await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/expenses/${editExpense.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      } else {
        await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/expenses`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      }
      onSaved()
    } catch {} finally { setSaving(false) }
  }

  const shareAmount = participants.length > 0 ? parseFloat(amount) / participants.length : 0

  return (
    <Modal open={open} onClose={onClose} title={editExpense ? t('expense.create.editTitle') : t('expense.create.title')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('expense.create.concept')}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required maxLength={200}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('expense.create.amount')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{currencySymbol(currency)}</span>
            <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" min="0.01" required
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
        </div>
        {participants.length > 1 && (
          <p className="text-xs text-slate-400">{t('expense.create.equalSplit', { amount: formatAmount(shareAmount, currency) })}</p>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('expense.create.paidBy')}</label>
          <select value={paidBy} onChange={e => setPaidBy(e.target.value)} required
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            <option value="">{t('expense.create.paidBy')}</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name ?? t('common.unknown')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('expense.create.participants')}</label>
          <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-100 rounded-lg p-2">
            {members.map(m => (
              <label key={m.user_id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer">
                <input type="checkbox" checked={participants.includes(m.user_id)}
                  onChange={e => setParticipants(e.target.checked ? [...participants, m.user_id] : participants.filter(id => id !== m.user_id))}
                  className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
                />
                <span className="text-sm text-slate-700">{m.display_name ?? t('common.unknown')}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('expense.create.tag')}</label>
          <select value={tagId} onChange={e => setTagId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            <option value="">{t('expense.create.noTag')}</option>
            {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">{t('expense.create.cancel')}</button>
          <button type="submit" disabled={saving || !title.trim() || !amount || !paidBy || participants.length === 0}
            className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1.5"
          >{saving && <Loader2 className="w-3 h-3 animate-spin" />}{editExpense ? t('expense.create.save') : t('expense.create.create')}</button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Delete Confirm ─────────────────────────────────────────────────────

function DeleteConfirm({ open, onClose, onDeleted, groupId, expense }: {
  open: boolean; onClose: () => void; onDeleted: () => void; groupId: string; expense: Expense | null
}) {
  const ctx = useAppContext()
  const t = useTranslations('apps.split-expenses')
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!expense || !ctx.groupSlug) return
    setDeleting(true)
    try {
      await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/expenses/${expense.id}`, { method: 'DELETE' })
      onDeleted()
    } catch {} finally { setDeleting(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('expense.delete.title')}>
      <p className="text-sm text-slate-600 mb-4">{t('expense.delete.confirm', { title: expense?.title ?? '' })}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">{t('common.cancel')}</button>
        <button onClick={handleDelete} disabled={deleting}
          className="px-4 py-1.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5"
        >{deleting && <Loader2 className="w-3 h-3 animate-spin" />}{t('common.delete')}</button>
      </div>
    </Modal>
  )
}

// ─── Balances Tab ───────────────────────────────────────────────────────

function BalancesTab({ groupId, group }: { groupId: string; group: GroupDetail }) {
  const ctx = useAppContext()
  const locale = useLocale()
  const t = useTranslations('apps.split-expenses')
  const [balances, setBalances] = useState<Balance[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [settling, setSettling] = useState(false)
  const [showSettleConfirm, setShowSettleConfirm] = useState(false)
  const [settleHistory, setSettleHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [refresh, setRefresh] = useState(0)

  async function fetchBalances() {
    if (!ctx.groupSlug) return
    setLoading(true)
    try {
      const res = await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/balances`)
      if (res.ok) {
        const data = await res.json()
        setBalances(data.balances ?? [])
        setTransfers(data.transfers ?? [])
      }
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchBalances() }, [groupId, ctx.groupSlug, refresh])

  async function handleSettle() {
    if (!ctx.groupSlug) return
    setSettling(true)
    try {
      await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/settlements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      setShowSettleConfirm(false)
      setRefresh(r => r + 1)
    } catch {} finally { setSettling(false) }
  }

  async function fetchSettleHistory() {
    if (!ctx.groupSlug) return
    try {
      const res = await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/settlements`)
      if (res.ok) {
        setSettleHistory(await res.json())
        setShowHistory(true)
      }
    } catch {}
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>

  return (
    <div>
      <div className="space-y-2 mb-6">
        {balances.map(b => (
          <div key={b.user_id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100">
            <span className="text-sm font-medium text-slate-700">{b.display_name ?? t('common.unknown')}</span>
            <span className={`text-sm font-semibold ${b.net_balance > 0 ? 'text-emerald-600' : b.net_balance < 0 ? 'text-red-500' : 'text-slate-400'}`}>
              {b.net_balance > 0
                ? `${t('balance.isOwed')} ${formatAmount(b.net_balance, group.currency)}`
                : b.net_balance < 0
                  ? `${t('balance.owe')} ${formatAmount(Math.abs(b.net_balance), group.currency)}`
                  : t('balance.noTransfers')}
            </span>
          </div>
        ))}
      </div>

      {transfers.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('balance.transfers')}</h3>
          <div className="space-y-1.5 mb-6">
            {transfers.map((tr, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-600 p-2 bg-slate-50 rounded-lg">
                <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span>{tr.from_name ?? t('common.unknown')} {t('balance.pays')} {tr.to_name ?? t('common.unknown')}</span>
                <span className="ml-auto font-semibold text-slate-900">{formatAmount(tr.amount, group.currency)}</span>
              </div>
            ))}
          </div>

          <button onClick={() => setShowSettleConfirm(true)}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
          >{t('balance.settleAll')}</button>
        </>
      )}

      <button onClick={fetchSettleHistory} className="mt-3 text-xs text-slate-400 hover:text-slate-600 underline">{t('balance.history')}</button>

      <Modal open={showSettleConfirm} onClose={() => setShowSettleConfirm(false)} title={t('balance.confirmTitle')}>
        <p className="text-sm text-slate-600 mb-2">{t('balance.confirmMessage', { count: transfers.length })}</p>
        <div className="space-y-1 mb-4">
          {transfers.map((tr, i) => (
            <p key={i} className="text-xs text-slate-500">{tr.from_name ?? t('common.unknown')} → {tr.to_name ?? t('common.unknown')}: {formatAmount(tr.amount, group.currency)}</p>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setShowSettleConfirm(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">{t('expense.create.cancel')}</button>
          <button onClick={handleSettle} disabled={settling}
            className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1.5"
          >{settling && <Loader2 className="w-3 h-3 animate-spin" />}{t('balance.confirm')}</button>
        </div>
      </Modal>

      <Modal open={showHistory} onClose={() => setShowHistory(false)} title={t('balance.history')}>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {settleHistory.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">{t('balance.noSettlements')}</p>
          ) : settleHistory.map((s: any) => (
            <div key={s.id} className="p-3 border border-slate-100 rounded-lg">
              <p className="text-xs text-slate-400">{t('balance.settledOn')} {new Date(s.created_at).toLocaleDateString(locale)} {t('balance.by')} {s.settled_by_name ?? t('common.unknown')}</p>
              <p className="text-xs text-slate-500">{t('balance.expenseCount', { count: s.expense_count })} · {t('balance.transferCount', { count: s.transfers?.length ?? 0 })}</p>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

// ─── Members Tab ────────────────────────────────────────────────────────

function MembersTab({ groupId, group, onUpdate }: { groupId: string; group: GroupDetail; onUpdate: () => void }) {
  const ctx = useAppContext()
  const t = useTranslations('apps.split-expenses')
  const [showAdd, setShowAdd] = useState(false)
  const [groupMembers, setGroupMembers] = useState<{ id: string; display_name: string }[]>([])
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState('')

  useEffect(() => {
    if (!ctx.groupSlug) return
    fetch(`/api/v1/${ctx.groupSlug}/members`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data?.data ?? []
        const existingIds = new Set(group.members?.map(m => m.user_id))
        setGroupMembers(list.filter((m: { user_id: string }) => !existingIds.has(m.user_id)).map((m: { user_id: string; display_name?: string }) => ({ id: m.user_id, display_name: m.display_name ?? t('common.unknown') })))
      })
      .catch(() => {})
  }, [ctx.groupSlug, group.members])

  async function handleAdd() {
    if (!selected || !ctx.groupSlug) return
    setAdding(true)
    try {
      await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: selected }),
      })
      setShowAdd(false)
      setSelected('')
      onUpdate()
    } catch {} finally { setAdding(false) }
  }

  async function handleToggle(memberId: string, active: boolean) {
    if (!ctx.groupSlug) return
    await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/members/${memberId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }),
    })
    onUpdate()
  }

  async function handleRemove(memberId: string) {
    if (!ctx.groupSlug) return
    await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/members/${memberId}`, { method: 'DELETE' })
    onUpdate()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">{t('member.list.title')}</h3>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
        ><Users className="w-3 h-3" /> {t('member.list.add')}</button>
      </div>

      <div className="space-y-2">
        {group.members?.map(m => (
          <div key={m.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100">
            <span className="text-sm font-medium text-slate-700 flex-1">{m.display_name ?? t('common.unknown')}</span>
            <button onClick={() => handleToggle(m.id, !m.active)}
              className={`text-xs px-2 py-0.5 rounded-full ${m.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
            >{m.active ? t('member.list.active') : t('member.list.inactive')}</button>
            <button onClick={() => handleRemove(m.id)} className="p-1 text-slate-300 hover:text-red-500 rounded"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={t('member.addModal.title')}>
        <div className="space-y-4">
          {groupMembers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">{t('member.addModal.noMembers')}</p>
          ) : (
            <>
              <select value={selected} onChange={e => setSelected(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                <option value="">{t('member.addModal.placeholder')}</option>
                {groupMembers.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">{t('common.cancel')}</button>
                <button onClick={handleAdd} disabled={adding || !selected}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1.5"
                >{adding && <Loader2 className="w-3 h-3 animate-spin" />}{t('member.addModal.confirm')}</button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

// ─── Stats Tab ──────────────────────────────────────────────────────────

function StatsTab({ groupId }: { groupId: string }) {
  const ctx = useAppContext()
  const t = useTranslations('apps.split-expenses')
  const [period, setPeriod] = useState('month')
  const [tagId, setTagId] = useState('')
  const [mode, setMode] = useState<'byPeriod' | 'cumulative'>('byPeriod')
  const [data, setData] = useState<{ byPeriod: { label: string; total: number }[]; cumulative: { label: string; total: number }[] }>({ byPeriod: [], cumulative: [] })
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ctx.groupSlug) return
    async function fetchStats() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ period })
        if (tagId) params.set('tag_id', tagId)
        const [res, tagRes] = await Promise.all([
          fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/stats?${params}`),
          fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/tags`),
        ])
        if (res.ok) setData(await res.json())
        if (tagRes.ok) setTags(await tagRes.json())
      } catch {} finally { setLoading(false) }
    }
    fetchStats()
  }, [groupId, ctx.groupSlug, period, tagId])

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {(['byPeriod', 'cumulative'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === m ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >{t(`stats.${m}`)}</button>
          ))}
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white ml-auto">
          <option value="day">{t('stats.day')}</option>
          <option value="week">{t('stats.week')}</option>
          <option value="month">{t('stats.month')}</option>
          <option value="year">{t('stats.year')}</option>
        </select>
        <select value={tagId} onChange={e => setTagId(e.target.value)} className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white">
          <option value="">{t('stats.filterTag')}</option>
          {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : data.byPeriod.length === 0 ? (
        <p className="text-center py-8 text-sm text-slate-400">{t('stats.noData')}</p>
      ) : (
        <SpendingChart data={mode === 'byPeriod' ? data.byPeriod : data.cumulative} cumulative={mode === 'cumulative'} period={period} />
      )}
    </div>
  )
}
