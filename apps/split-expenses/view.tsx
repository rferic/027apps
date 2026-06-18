'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useAppContext } from '@/lib/apps/context'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Loader2, Pencil, Trash2, Check, Users, ArrowLeftRight, ChevronDown, Filter, Send } from 'lucide-react'
import { DsButton } from '@/components/ds/button'
import { DsModal } from '@/components/ds/modal'
import { DsCard } from '@/components/ds/card'
import { DsBadge } from '@/components/ds/badge'
import { DsCheckbox } from '@/components/ds/checkbox'
import { DsTabs } from '@/components/ds/tabs'
import { DsToggle } from '@/components/ds/toggle'
import { DsSkeleton } from '@/components/ds/skeleton'
import { DsEmptyState } from '@/components/ds/empty-state'
import { DsAvatar } from '@/components/ds/avatar'

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
          className={`w-8 h-8 text-lg flex items-center justify-center rounded-lg border ${value === e ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-border hover:border-border'}`}
        >{e}</button>
      ))}
    </div>
  )
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return <DsModal open={open} onClose={onClose} title={title}>{children}</DsModal>
}

// ─── Chart ──────────────────────────────────────────────────────────────

import { BarChart } from '@/components/composite/bar-chart'

function chartData(data: { label: string; total: number }[], cumulative: boolean) {
  return cumulative ? data.reduce<{ label: string; total: number }[]>((acc, d) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].total : 0
    acc.push({ label: d.label, total: prev + d.total })
    return acc
  }, []) : data
}

// ─── Types ──────────────────────────────────────────────────────────────

interface ExpenseGroup {
  id: string; title: string; emoji: string; currency: string;
  created_by: string; created_at: string; member_count?: number; my_balance?: number;
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
    <div className="px-4 py-6 sm:px-6 overflow-x-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10B981', color: '#fff' }}>
            <ArrowLeftRight size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('group.list.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('group.list.totalBalance', { count: groups.length })}</p>
          </div>
        </div>
        <DsButton color="#10B981" onClick={() => setShowCreateGroup(true)}><Plus size={14} /> {t('group.create.title')}</DsButton>
      </div>

      {loading ? (
        <div className="py-16"><DsSkeleton height={120} count={3} /></div>
      ) : groups.length === 0 ? (
        <DsEmptyState icon="💰" title={t('group.list.empty')} action={<DsButton color="#10B981" onClick={() => setShowCreateGroup(true)}>{t('group.list.createFirst')}</DsButton>} />
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <DsCard key={g.id} padding="lg" hover onClick={() => setSelectedGroup(g.id)}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{g.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{g.title}</p>
                    <p className="text-xs text-muted-foreground">{t('group.list.memberCount', { count: g.member_count ?? 0 })} · {currencySymbol(g.currency)}</p>
                    {g.my_balance !== undefined && (
                      <p className="text-xs mt-0.5" style={{ color: g.my_balance > 0 ? '#10B981' : g.my_balance < 0 ? '#F97316' : 'var(--color-text-secondary)' }}>
                        {g.my_balance > 0
                          ? `+${currencySymbol(g.currency)}${g.my_balance.toFixed(2)}`
                          : g.my_balance < 0
                            ? `-${currencySymbol(g.currency)}${Math.abs(g.my_balance).toFixed(2)}`
                            : '✓ ' + t('balance.noTransfers')}
                      </p>
                    )}
                  </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90 flex-shrink-0" />
              </div>
            </DsCard>
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
    <DsModal open={open} onClose={onClose} title={editGroup ? t('group.create.editTitle') : t('group.create.title')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('group.create.name')}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('group.create.name')} required maxLength={100}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-card text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('group.create.emoji')}</label>
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('group.create.currency')}</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-card text-foreground"
          >
            {Object.entries(CURRENCY_SYMBOLS).sort().map(([code, sym]) => (
              <option key={code} value={code}>{code} ({sym})</option>
            ))}
          </select>
        </div>
        {!editGroup && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('group.create.members')}</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {groupMembers.map(m => (
                <div key={m.id} className="px-2 py-1 hover:bg-accent rounded">
                  <DsCheckbox color="#10B981" label={m.display_name} checked={members.includes(m.id)} onChange={e => setMembers(e.target.checked ? [...members, m.id] : members.filter(id => id !== m.id))} />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <DsButton variant="ghost" onClick={onClose}>{t('group.create.cancel')}</DsButton>
          <DsButton color="#10B981" disabled={saving || !title.trim()} type="submit">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}{editGroup ? t('group.create.save') : t('group.create.create')}
          </DsButton>
        </div>
      </form>
    </DsModal>
  )
}

// ─── Group Detail ───────────────────────────────────────────────────────

const TABS = ['expenses', 'balances', 'stats', 'settings'] as const

function GroupDetailView({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const ctx = useAppContext()
  const t = useTranslations('apps.split-expenses')
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<typeof TABS[number]>('expenses')
  const [showEditGroup, setShowEditGroup] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  // Centralized tab data — fetched once, shared to all tabs
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [allMembers, setAllMembers] = useState<{ id: string; display_name: string }[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [statsData, setStatsData] = useState<{ byPeriod: { label: string; total: number }[]; cumulative: { label: string; total: number }[] }>({ byPeriod: [], cumulative: [] })

  const [refreshKey, setRefreshKey] = useState(0)
  const [dataLoading, setDataLoading] = useState(true)

  // Stats filter state (managed here so the parent refetches)
  const [showCreateExpense, setShowCreateExpense] = useState(false)
  const [expensePage, setExpensePage] = useState(1)
  const [expenseTotalPages, setExpenseTotalPages] = useState(1)
  const [showSettled, setShowSettled] = useState(false)
  const [statsPeriod, setStatsPeriod] = useState('month')
  const [statsTagId, setStatsTagId] = useState('')
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (!ctx.groupSlug) return
    setLoading(true)
    setFetchError(false)
    ;(async () => {
      try {
        const [groupRes, expRes, tagRes, balRes, memRes, sessionRes, statsRes] = await Promise.all([
          fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}`),
          fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/expenses?limit=50&page=1${!showSettled ? '&settled=false' : ''}`),
          fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/tags`),
          fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/balances`),
          fetchWithAuth(`/api/v1/${ctx.groupSlug}/members`),
          supabase.auth.getSession(),
          fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/stats?period=${statsPeriod}${statsTagId ? `&tag_id=${statsTagId}` : ''}`),
        ])
        if (groupRes.ok) setGroup(await groupRes.json())
        else setFetchError(true)
        if (expRes.ok) { const r = await expRes.json(); setExpenses(r.data ?? []); setExpenseTotalPages(r.pagination?.total_pages ?? 1) }
        if (tagRes.ok) { const d = await tagRes.json(); setTags(Array.isArray(d) ? d : d?.data ?? []) }
        if (balRes.ok) { const d = await balRes.json(); setBalances(d.balances ?? []); setTransfers(d.transfers ?? []) }
        if (statsRes.ok) setStatsData(await statsRes.json())
        if (memRes.ok) {
          const d = await memRes.json()
          const list = Array.isArray(d) ? d : d?.data ?? []
          setAllMembers(list.map((m: { user_id: string; display_name?: string }) => ({ id: m.user_id, display_name: m.display_name ?? t('common.unknown') })))
        }
        const { data: { session } } = sessionRes
        if (session?.user) setCurrentUserId(session.user.id)
      } catch { setFetchError(true) }
      finally { setLoading(false); setDataLoading(false); setStatsLoading(false) }
    })()
  }, [groupId, ctx.groupSlug, refreshKey, statsPeriod, statsTagId, showSettled])

  // Separate fetch for expense pagination (appends data for infinite scroll)
  useEffect(() => {
    if (!ctx.groupSlug || expensePage <= 1) return
    ;(async () => {
      const res = await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/expenses?limit=50&page=${expensePage}${!showSettled ? '&settled=false' : ''}`)
      if (res.ok) { const r = await res.json(); setExpenses(prev => [...prev, ...(r.data ?? [])]); setExpenseTotalPages(r.pagination?.total_pages ?? 1) }
    })()
  }, [expensePage, showSettled])

  // Derived: members of the parent group not yet in this expense group
  const availableMembers = allMembers.filter(am => {
    const existingIds = new Set(group?.members?.map(m => m.user_id) ?? [])
    return !existingIds.has(am.id)
  })

  const handleRefresh = () => {
    setDataLoading(true)
    setRefreshKey(k => k + 1)
  }

  const handleMembersUpdate = () => {
    setLoading(true)
    setDataLoading(true)
    setRefreshKey(k => k + 1)
  }

  if (loading) {
    return <div className="py-16"><DsSkeleton height={120} count={3} /></div>
  }

  if (fetchError || !group) {
    return (
      <DsEmptyState icon="💰" title={t('group.detail.noGroup')} action={<DsButton variant="ghost" onClick={onBack}>{t('common.back')}</DsButton>} />
    )
  }

  const activeMembers = group.members?.filter(m => m.active) ?? []

  return (
    <div className="px-4 py-6 sm:px-6 overflow-x-hidden">
      <DsButton variant="ghost" onClick={onBack} style={{ marginBottom: 16 }}>
        <ChevronDown className="w-4 h-4 rotate-90" /> {t('common.back')}
      </DsButton>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">{group.emoji}</span>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground">{group.title}</h1>
          <p className="text-xs text-muted-foreground">{currencySymbol(group.currency)} · {t('group.detail.memberCount', { count: group.members?.length ?? 0 })}</p>
          {currentUserId && (() => {
            const myBalance = balances.find(b => b.user_id === currentUserId)
            if (!myBalance) return null
            return (
              <p className="text-xs mt-1" style={{ color: myBalance.net_balance > 0 ? '#10B981' : myBalance.net_balance < 0 ? '#F97316' : 'var(--color-text-secondary)' }}>
                {myBalance.net_balance > 0
                  ? `${t('balance.isOwed')} ${formatAmount(myBalance.net_balance, group.currency)}`
                  : myBalance.net_balance < 0
                    ? `${t('balance.owe')} ${formatAmount(Math.abs(myBalance.net_balance), group.currency)}`
                    : t('balance.noTransfers')}
              </p>
            )
          })()}
        </div>
        {tab === 'expenses' && <DsButton color="#10B981" onClick={() => setShowCreateExpense(true)}><Plus size={14} /> {t('expense.create.title')}</DsButton>}
        <DsButton variant="ghost" onClick={() => setShowEditGroup(true)}><Pencil size={16} /></DsButton>
      </div>

      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === tabKey ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >{t(`group.detail.tabs.${tabKey}` as any)}</button>
        ))}
      </div>

      {tab === 'expenses' && <ExpensesTab groupId={groupId} expenses={expenses} tags={tags} currentUserId={currentUserId} members={activeMembers} allMembers={group.members ?? []} currency={group.currency} loading={dataLoading} onRefresh={handleRefresh} showCreate={showCreateExpense} onShowCreate={setShowCreateExpense} page={expensePage} totalPages={expenseTotalPages} onPageChange={setExpensePage} showSettled={showSettled} onToggleSettled={() => setShowSettled(v => !v)} />}
      {tab === 'balances' && <BalancesTab groupId={groupId} balances={balances} transfers={transfers} currency={group.currency} loading={dataLoading} onRefresh={handleRefresh} onSettle={() => setRefreshKey(k => k + 1)} />}
      {tab === 'stats' && <StatsTab statsData={statsData} tags={tags} period={statsPeriod} tagId={statsTagId} loading={statsLoading} onPeriodChange={setStatsPeriod} onTagIdChange={setStatsTagId} />}
      {tab === 'settings' && <SettingsTab groupId={groupId} group={group} tags={tags} loading={dataLoading} onRefresh={handleRefresh} availableMembers={availableMembers} onMembersUpdate={handleMembersUpdate} />}

      {showEditGroup && <CreateGroupModal open={showEditGroup} onClose={() => setShowEditGroup(false)} onCreated={() => { setShowEditGroup(false); setRefreshKey(k => k + 1) }} editGroup={group} />}
    </div>
  )
}

// ─── Expenses Tab ───────────────────────────────────────────────────────

function ExpensesTab({ groupId, expenses, tags, currentUserId, members, allMembers, currency, loading, onRefresh, showCreate, onShowCreate, page, totalPages, onPageChange, showSettled, onToggleSettled }: {
  groupId: string; expenses: Expense[]; tags: Tag[]; currentUserId: string;
  members: Member[]; allMembers: Member[]; currency: string; loading: boolean; onRefresh: () => void;
  showCreate: boolean; onShowCreate: (v: boolean) => void;
  page: number; totalPages: number; onPageChange: (p: number) => void;
  showSettled: boolean; onToggleSettled: () => void;
}) {
  const locale = useLocale()
  const t = useTranslations('apps.split-expenses')
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null)
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [filterPaidBy, setFilterPaidBy] = useState('')
  const [draftTags, setDraftTags] = useState<string[]>([])
  const [draftPaidBy, setDraftPaidBy] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [viewMode, setViewMode] = useState<'all' | 'my'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('split-expenses-view') as 'all' | 'my') || 'my'
    return 'my'
  })

  const filteredExpenses = expenses.filter(e => {
    if (viewMode === 'my' && currentUserId) {
      const isParticipant = e.paid_by === currentUserId || e.shares?.some(s => s.user_id === currentUserId)
      if (!isParticipant) return false
    }
    if (filterTags.length > 0 && !filterTags.includes(e.tag_id ?? '')) return false
    if (filterPaidBy && e.paid_by !== filterPaidBy) return false
    return true
  })

  const activeFilters = filterTags.length + (filterPaidBy ? 1 : 0)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const hasMore = page < totalPages

  const loadMore = useCallback(() => {
    if (hasMore && !loading) onPageChange(page + 1)
  }, [hasMore, loading, page, onPageChange])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore() }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  function openFilters() {
    setDraftTags([...filterTags]); setDraftPaidBy(filterPaidBy); setShowFilters(true)
  }

  function applyFilters() {
    setFilterTags([...draftTags]); setFilterPaidBy(draftPaidBy); setShowFilters(false); onPageChange(1)
  }

  function toggleDraftTag(tagId: string) {
    setDraftTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId])
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button onClick={() => { setViewMode('my'); localStorage.setItem('split-expenses-view', 'my'); onPageChange(1) }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'my' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >{t('expense.list.my')}</button>
          <button onClick={() => { setViewMode('all'); localStorage.setItem('split-expenses-view', 'all'); onPageChange(1) }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'all' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >{t('expense.list.all')}</button>
        </div>
        <button onClick={openFilters} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground hover:bg-accent cursor-pointer transition-colors">
          <Filter size={14} /> {t('expense.list.filters')}
          {activeFilters > 0 && <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold rounded-full" style={{ backgroundColor: '#10B981', color: 'white' }}>{activeFilters}</span>}
        </button>
      </div>
      {activeFilters > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {filterTags.map(tagId => { const tag = tags.find(t => t.id === tagId); if (!tag) return null; return (
            <span key={tag.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full cursor-pointer" style={{ backgroundColor: tag.color + '20', color: tag.color }} onClick={() => setFilterTags(prev => prev.filter(t => t !== tagId))}>
              {tag.name} <X size={10} />
            </span>
          )})}
          {filterPaidBy && (() => { const m = allMembers.find(m => m.user_id === filterPaidBy); return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-muted text-foreground cursor-pointer" onClick={() => setFilterPaidBy('')}>
              {m?.display_name ?? filterPaidBy} <X size={10} />
            </span>
          )})()}
          {activeFilters > 0 && (
            <button onClick={() => { setFilterTags([]); setFilterPaidBy('') }} className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer">
              {t('expense.list.clearFilters')}
            </button>
          )}
        </div>
      )}

      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowFilters(false)}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative bg-card rounded-t-2xl sm:rounded-xl p-6 w-full max-w-md mx-auto shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-foreground">{t('expense.list.filters')}</h3>
              <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={20} /></button>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{t('expense.list.allTags')}</label>
              <div className="relative mb-2">
                <input value={tagInput} onChange={e => {
                  setTagInput(e.target.value)
                }} onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); if (!tagInput.trim()) return; const match = tags.find(t => t.name.toLowerCase() === tagInput.trim().toLowerCase()); if (match && !draftTags.includes(match.id)) toggleDraftTag(match.id); setTagInput('') }
                }} placeholder={t('expense.list.allTags')}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-card text-foreground"
                />
                {tagInput.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-32 overflow-auto">
                    {tags.filter(t => t.name.toLowerCase().includes(tagInput.toLowerCase()) && !draftTags.includes(t.id)).map(tag => (
                      <div key={tag.id} onMouseDown={() => { toggleDraftTag(tag.id); setTagInput('') }}
                        className="px-3 py-1.5 text-sm text-foreground hover:bg-accent cursor-pointer"
                      >{tag.name}</div>
                    ))}
                  </div>
                )}
              </div>
              {draftTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {draftTags.map(tagId => { const tag = tags.find(t => t.id === tagId); if (!tag) return null; return (
                    <span key={tag.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                      {tag.name} <X size={10} className="cursor-pointer" style={{ color: tag.color }} onClick={() => toggleDraftTag(tag.id)} />
                    </span>
                  )})}
                </div>
              )}
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{t('expense.list.allUsers')}</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setDraftPaidBy('')} className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${draftPaidBy === '' ? 'font-medium' : 'bg-muted text-foreground hover:bg-accent'}`} style={draftPaidBy === '' ? { backgroundColor: '#10B981', color: 'white' } : {}}>
                  {t('expense.list.allUsers')}
                </button>
                {allMembers.map(m => (
                  <button key={m.user_id} onClick={() => setDraftPaidBy(m.user_id)} className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${draftPaidBy === m.user_id ? 'font-medium' : 'bg-muted text-foreground hover:bg-accent'}`} style={draftPaidBy === m.user_id ? { backgroundColor: '#10B981', color: 'white' } : {}}>
                    {m.display_name ?? t('common.unknown')}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-foreground">{t('expense.list.settled')}</span>
                <DsToggle checked={showSettled} onChange={onToggleSettled} />
              </div>
            </div>

            <button onClick={() => { setShowFilters(false) }} className="w-full py-3 text-sm font-semibold text-white rounded-xl cursor-pointer shadow-sm transition-colors" style={{ backgroundColor: '#10B981' }}>
              {t('expense.list.filters')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8"><DsSkeleton height={60} count={4} /></div>
      ) : filteredExpenses.length === 0 ? (
        <DsEmptyState title={t('expense.list.empty')} />
      ) : (
        <div>
          {(() => {
            const grouped: Record<string, typeof filteredExpenses> = {}
            for (const e of filteredExpenses) {
              const d = new Date(e.created_at)
              const key = `${d.getFullYear()}-${d.getMonth()}`
              if (!grouped[key]) grouped[key] = []
              grouped[key].push(e)
            }
            return Object.entries(grouped).map(([key, items]) => {
              const [year, month] = key.split('-').map(Number)
              const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
              return (
                <div key={key} className="mb-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{monthNames[month]} {year}</h3>
                  <div className="space-y-1">
                    {items.map(e => {
                      const tag = tags.find(t => t.id === e.tag_id)
                      const myShare = currentUserId ? e.shares?.find(s => s.user_id === currentUserId) : null
                      const iPaid = currentUserId && e.paid_by === currentUserId
                      const involvementAmount = iPaid && myShare ? Number(e.amount) - myShare.amount : myShare?.amount ?? null
                      const involvementColor = involvementAmount !== null ? (iPaid ? '#10B981' : '#F97316') : 'var(--color-text)'
                      const day = new Date(e.created_at).getDate()
                      return (
                        <div key={e.id} style={e.settled ? { background: 'var(--color-muted)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)' } : {}}>
                          <DsCard padding="sm" hover={!e.settled} onClick={() => setDetailExpense(e)} style={e.settled ? { background: 'transparent', border: 'none', opacity: 0.75 } : {}}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: e.settled ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: 'var(--color-muted)', flexShrink: 0, opacity: e.settled ? 0.6 : 1 }}>{day}</span>
                              <div className="flex-1 min-w-0">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <p style={{ fontSize: 13, fontWeight: 500, color: e.settled ? 'var(--color-text-secondary)' : 'var(--color-text)', textDecoration: e.settled ? 'line-through' : 'none', margin: 0 }}>
                                    {e.title}
                                  </p>
                                  {tag && <DsBadge variant="neutral" style={{ backgroundColor: tag.color + '20', color: tag.color, fontSize: 10, opacity: e.settled ? 0.5 : 1 }}>{tag.name}</DsBadge>}
                                </div>
                                <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: '1px 0 0', textDecoration: e.settled ? 'line-through' : 'none', opacity: e.settled ? 0.6 : 1 }}>
                                  {e.paid_by_profile?.display_name ?? t('common.unknown')} {t('expense.item.paidBy')} {formatAmount(e.amount, currency)}
                                </p>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                {involvementAmount !== null ? (
                                  <p style={{ fontSize: 13, fontWeight: 700, color: e.settled ? 'var(--color-text-secondary)' : involvementColor, margin: 0, textDecoration: e.settled ? 'line-through' : 'none', opacity: e.settled ? 0.6 : 1 }}>
                                    {iPaid ? `+${formatAmount(involvementAmount, currency)}` : `-${formatAmount(involvementAmount, currency)}`}
                                  </p>
                                ) : (
                                  <p style={{ fontSize: 13, fontWeight: 600, color: e.settled ? 'var(--color-text-secondary)' : 'var(--color-text)', margin: 0, textDecoration: e.settled ? 'line-through' : 'none', opacity: e.settled ? 0.6 : 1 }}>
                                    {formatAmount(e.amount, currency)}
                                  </p>
                                )}
                              </div>
                              {!e.settled && (
                                <span onClick={ev => { ev.stopPropagation(); setDeleteExpense(e) }}><DsButton variant="ghost" size="sm"><Trash2 size={14} /></DsButton></span>
                              )}
                            </div>
                          </DsCard>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}

      {hasMore && <div ref={sentinelRef} className="h-4" />}

      <ExpenseModal open={showCreate || !!editExpense} onClose={() => { onShowCreate(false); setEditExpense(null) }}
        onSaved={() => { onShowCreate(false); setEditExpense(null); onRefresh() }}
        groupId={groupId} members={members} tags={tags} currency={currency} editExpense={editExpense}
        currentUserId={currentUserId} />

      <DeleteConfirm open={!!deleteExpense} onClose={() => setDeleteExpense(null)}
        onDeleted={() => { setDeleteExpense(null); onRefresh() }}
        groupId={groupId} expense={deleteExpense} />

      <ExpenseDetailModal open={!!detailExpense} onClose={() => setDetailExpense(null)}
        expense={detailExpense} group={{ members, currency } as GroupDetail} tags={tags}
        onEdit={() => { const e = detailExpense; setDetailExpense(null); setEditExpense(e) }}
        onSettled={() => { setDetailExpense(null); onRefresh() }}
        onDeleted={() => { setDetailExpense(null); onRefresh() }} />
    </div>
  )
}

// ─── Expense Modal ──────────────────────────────────────────────────────

function ExpenseModal({ open, onClose, onSaved, groupId, members, tags, currency, editExpense, currentUserId }: {
  open: boolean; onClose: () => void; onSaved: () => void;
  groupId: string; members: Member[]; tags: Tag[]; currency: string; editExpense?: Expense | null;
  currentUserId?: string;
}) {
  const ctx = useAppContext()
  const t = useTranslations('apps.split-expenses')
  const [title, setTitle] = useState(editExpense?.title ?? '')
  const [amount, setAmount] = useState(editExpense?.amount?.toString() ?? '')
  const [paidBy, setPaidBy] = useState(editExpense?.paid_by ?? currentUserId ?? '')
  const [participants, setParticipants] = useState<string[]>(editExpense?.shares?.map(s => s.user_id) ?? (currentUserId ? [currentUserId] : []))
  const [tagId, setTagId] = useState(editExpense?.tag_id ?? '')
  const [saving, setSaving] = useState(false)
  const [newTagName, setNewTagName] = useState(tags.find(t => t.id === editExpense?.tag_id)?.name ?? '')
  const [newTagColor, setNewTagColor] = useState('#10B981')
  const [creatingTag, setCreatingTag] = useState(false)
  const [localTags, setLocalTags] = useState<Tag[]>(tags)

  useEffect(() => {
    if (!open) return
    setTitle(editExpense?.title ?? '')
    setAmount(editExpense?.amount?.toString() ?? '')
    setPaidBy(editExpense?.paid_by ?? currentUserId ?? '')
    setParticipants(editExpense?.shares?.map(s => s.user_id) ?? members.filter(m => m.active).map(m => m.user_id))
    setTagId(editExpense?.tag_id ?? '')
    setNewTagName(tags.find(t => t.id === editExpense?.tag_id)?.name ?? '')
    setLocalTags(tags)
  }, [open, editExpense, currentUserId, members, tags])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !amount || !paidBy || participants.length === 0 || !ctx.groupSlug) return
    const parsedAmount = parseFloat(amount.replace(',', '.'))
    if (isNaN(parsedAmount) || parsedAmount <= 0) return
    let resolvedTagId: string | null = tagId
    if (newTagName.trim() && !tagId) {
      const match = localTags.find(t => t.name.toLowerCase() === newTagName.trim().toLowerCase())
      if (match) { resolvedTagId = match.id; setTagId(match.id) }
      else { resolvedTagId = await handleCreateTag(); if (!resolvedTagId) return }
    }
    setSaving(true)
    try {
      const body = { title: title.trim(), amount: parsedAmount, paid_by: paidBy, participant_ids: participants, tag_id: resolvedTagId || null }
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

  async function handleCreateTag(): Promise<string | null> {
    if (!newTagName.trim() || !ctx.groupSlug) return null
    const match = localTags.find(t => t.name.toLowerCase() === newTagName.trim().toLowerCase())
    if (match) { setTagId(match.id); setNewTagName(''); return match.id }
    setCreatingTag(true)
    try {
      const res = await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/tags`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      })
      if (res.ok) {
        const newTag = await res.json()
        setLocalTags(prev => [...prev, newTag])
        setTagId(newTag.id)
        setNewTagName('')
        return newTag.id
      }
      return null
    } catch { return null } finally { setCreatingTag(false) }
  }

  const shareAmount = participants.length > 0 ? (parseFloat(amount.replace(',', '.')) || 0) / participants.length : 0

  return (
    <DsModal open={open} onClose={onClose} title={editExpense ? t('expense.create.editTitle') : t('expense.create.title')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('expense.create.concept')}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required maxLength={200}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-card text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('expense.create.amount')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol(currency)}</span>
            <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} type="text" inputMode="decimal" required placeholder="0.00"
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-card text-foreground"
            />
          </div>
        </div>
        {participants.length > 1 && (
          <p className="text-xs text-muted-foreground">{t('expense.create.equalSplit', { amount: formatAmount(shareAmount, currency) })}</p>
        )}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('expense.create.paidBy')}</label>
          <select value={paidBy} onChange={e => setPaidBy(e.target.value)} required
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-card text-foreground"
          >
            <option value="">{t('expense.create.paidBy')}</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name ?? t('common.unknown')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('expense.create.participants')}</label>
          <div className="space-y-1 max-h-40 overflow-y-auto border border-border rounded-lg p-2">
            {members.map(m => (
              <label key={m.user_id} className="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded cursor-pointer">
                <DsCheckbox color="#10B981" checked={participants.includes(m.user_id)}
                  onChange={e => setParticipants(e.target.checked ? [...participants, m.user_id] : participants.filter(id => id !== m.user_id))}
                />
                <span className="text-sm text-foreground">{m.display_name ?? t('common.unknown')}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('expense.create.tag')}</label>
          {tagId ? (
            <div className="flex items-center gap-2">
              {(() => { const tag = localTags.find(t => t.id === tagId); return tag ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-lg" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                  {tag.name}
                  <X size={12} className="cursor-pointer" style={{ color: tag.color }} onClick={() => { setTagId(''); setNewTagName('') }} />
                </span>
              ) : null })()}
              <span className="text-xs text-muted-foreground cursor-pointer" onClick={() => { setTagId(''); setNewTagName('') }}>{t('expense.create.noTag')}</span>
            </div>
          ) : (
            <div className="relative">
              <input value={newTagName} onChange={e => {
                setNewTagName(e.target.value)
                if (tagId) setTagId('')
              }} onKeyDown={async (e) => {
                if (e.key === 'Enter') { e.preventDefault(); await handleCreateTag() }
              }}
                placeholder={t('expense.create.noTag')}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-card text-foreground"
              />
              {newTagName.trim() && !tagId && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-32 overflow-auto">
                  {localTags.filter(t => t.name.toLowerCase().includes(newTagName.toLowerCase())).map(tag => (
                    <div key={tag.id} onMouseDown={() => { setTagId(tag.id); setNewTagName('') }}
                      className="px-3 py-1.5 text-sm text-foreground hover:bg-accent cursor-pointer"
                    >{tag.name}</div>
                  ))}
                  <div onMouseDown={async () => { await handleCreateTag() }}
                    className="px-3 py-1.5 text-sm text-emerald-600 hover:bg-accent cursor-pointer border-t border-border"
                  >+ {t('tag.create.title')}</div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <DsButton variant="ghost" onClick={onClose}>{t('expense.create.cancel')}</DsButton>
          <DsButton color="#10B981" disabled={saving || !title.trim() || !amount || !paidBy || participants.length === 0} type="submit">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}{editExpense ? t('expense.create.save') : t('expense.create.create')}
          </DsButton>
        </div>
      </form>
    </DsModal>
  )
}

// ─── Expense Detail Modal ─────────────────────────────────────────────

function ExpenseDetailModal({ open, onClose, expense, group, tags, onEdit, onSettled, onDeleted }: {
  open: boolean; onClose: () => void; expense: Expense | null;
  group: GroupDetail; tags: Tag[];
  onEdit: () => void; onSettled: () => void; onDeleted: () => void;
}) {
  const ctx = useAppContext()
  const locale = useLocale()
  const t = useTranslations('apps.split-expenses')
  const [settling, setSettling] = useState(false)
  const [showSettleConfirm, setShowSettleConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!expense) return null

  const tag = tags.find(tg => tg.id === expense.tag_id)
  const totalShares = expense.shares?.reduce((sum, s) => sum + s.amount, 0) ?? 0

  return (
    <>
      <DsModal open={open} onClose={onClose} title={expense.title}>
        <div className="space-y-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>{formatAmount(expense.amount, group.currency)}</span>
            {tag && <DsBadge variant="neutral" style={{ backgroundColor: tag.color + '20', color: tag.color }}>{tag.name}</DsBadge>}
          </div>

          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ margin: 0 }}>{t('expense.create.paidBy')}: {expense.paid_by_profile?.display_name ?? t('common.unknown')}</p>
            <p style={{ margin: 0 }}>{new Date(expense.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          {expense.shares && expense.shares.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>{t('expense.create.participants')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {expense.shares.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text)' }}>
                    <span>{s.user_profile?.display_name ?? t('common.unknown')}</span>
                    <span style={{ fontWeight: 500 }}>{formatAmount(s.amount, group.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!expense.settled && (
            <DsButton color="#10B981" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowSettleConfirm(true)}>
              <Send size={16} /> {t('balance.settle')}
            </DsButton>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
            <DsButton variant="ghost" onClick={onEdit}><Pencil size={16} /></DsButton>
            {!expense.settled && (
              <DsButton variant="ghost" style={{ color: '#EF4444' }} onClick={() => setShowDeleteConfirm(true)}><Trash2 size={16} /></DsButton>
            )}
          </div>
        </div>
      </DsModal>

      <DsModal open={showSettleConfirm} onClose={() => setShowSettleConfirm(false)} title={t('balance.confirmTitle')}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>{t('balance.confirmMessage', { count: 1 })}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <DsButton variant="ghost" onClick={() => setShowSettleConfirm(false)}>{t('common.cancel')}</DsButton>
          <DsButton color="#10B981" disabled={settling} onClick={async () => {
            if (!ctx.groupSlug) return
            setSettling(true)
            try {
              await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${expense.expense_group_id}/settlements`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expense_ids: [expense.id] }),
              })
              onSettled()
            } catch {} finally { setSettling(false) }
          }}>
            {settling && <Loader2 className="w-3 h-3 animate-spin" />}{t('balance.confirm')}
          </DsButton>
        </div>
      </DsModal>

      <DsModal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title={t('expense.delete.title')}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>{t('expense.delete.confirm', { title: expense.title })}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <DsButton variant="ghost" onClick={() => setShowDeleteConfirm(false)}>{t('common.cancel')}</DsButton>
          <DsButton style={{ background: '#EF4444', color: 'white', border: 'none' }} disabled={deleting} onClick={async () => {
            if (!ctx.groupSlug) return
            setDeleting(true)
            try {
              await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${expense.expense_group_id}/expenses/${expense.id}`, { method: 'DELETE' })
              onDeleted()
            } catch {} finally { setDeleting(false) }
          }}>
            {deleting && <Loader2 className="w-3 h-3 animate-spin" />}{t('common.delete')}
          </DsButton>
        </div>
      </DsModal>
    </>
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
    <DsModal open={open} onClose={onClose} title={t('expense.delete.title')}>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>{t('expense.delete.confirm', { title: expense?.title ?? '' })}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <DsButton variant="ghost" onClick={onClose}>{t('common.cancel')}</DsButton>
        <DsButton style={{ background: '#EF4444', color: 'white', border: 'none' }} disabled={deleting} onClick={handleDelete}>
          {deleting && <Loader2 className="w-3 h-3 animate-spin" />}{t('common.delete')}
        </DsButton>
      </div>
    </DsModal>
  )
}

// ─── Balances Tab ───────────────────────────────────────────────────────

function BalancesTab({ groupId, balances, transfers, currency, loading, onRefresh, onSettle }: {
  groupId: string; balances: Balance[]; transfers: Transfer[]; currency: string; loading: boolean; onRefresh: () => void; onSettle?: () => void;
}) {
  const ctx = useAppContext()
  const locale = useLocale()
  const t = useTranslations('apps.split-expenses')
  const [settling, setSettling] = useState(false)
  const [showSettleConfirm, setShowSettleConfirm] = useState(false)
  const [settleHistory, setSettleHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)

  async function handleSettle() {
    if (!ctx.groupSlug) return
    setSettling(true)
    try {
      await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/settlements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      setShowSettleConfirm(false)
      ;(onSettle || onRefresh)()
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

  if (loading) return <div className="py-8"><DsSkeleton height={48} count={4} /></div>

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>{t('balance.title')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {balances.map(b => (
              <DsCard key={b.user_id} padding="sm" hover={false}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{b.display_name ?? t('common.unknown')}</span>
                  <span style={{
                    fontSize: 13, fontWeight: 600,
                    color: b.net_balance > 0 ? '#10B981' : b.net_balance < 0 ? '#DC2626' : 'var(--color-text-secondary)',
                  }}>
                    {b.net_balance > 0
                      ? `${t('balance.isOwed')} ${formatAmount(b.net_balance, currency)}`
                      : b.net_balance < 0
                        ? `${t('balance.owe')} ${formatAmount(Math.abs(b.net_balance), currency)}`
                        : t('balance.noTransfers')}
                  </span>
                </div>
              </DsCard>
            ))}
          </div>
        </div>

        <div>
          {transfers.length > 0 && (
            <>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>{t('balance.transfers')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {transfers.map((tr, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text)', padding: 8, background: 'var(--color-muted)', borderRadius: 'var(--radius-lg)' }}>
                    <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span>{tr.from_name ?? t('common.unknown')} {t('balance.pays')} {tr.to_name ?? t('common.unknown')}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--color-text)' }}>{formatAmount(tr.amount, currency)}</span>
                  </div>
                ))}
              </div>
              <DsButton color="#10B981" style={{ width: '100%' }} onClick={() => setShowSettleConfirm(true)}>{t('balance.settleAll')}</DsButton>
            </>
          )}
        </div>
      </div>

      <DsButton variant="ghost" onClick={fetchSettleHistory} style={{ fontSize: 12, textDecoration: 'underline' }}>{t('balance.history')}</DsButton>

      <DsModal open={showSettleConfirm} onClose={() => setShowSettleConfirm(false)} title={t('balance.confirmTitle')}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>{t('balance.confirmMessage', { count: transfers.length })}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
          {transfers.map((tr, i) => (
            <p key={i} style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>{tr.from_name ?? t('common.unknown')} → {tr.to_name ?? t('common.unknown')}: {formatAmount(tr.amount, currency)}</p>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <DsButton variant="ghost" onClick={() => setShowSettleConfirm(false)}>{t('expense.create.cancel')}</DsButton>
          <DsButton color="#10B981" disabled={settling} onClick={handleSettle}>
            {settling && <Loader2 className="w-3 h-3 animate-spin" />}{t('balance.confirm')}
          </DsButton>
        </div>
      </DsModal>

      <DsModal open={showHistory} onClose={() => setShowHistory(false)} title={t('balance.history')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflow: 'auto' }}>
          {settleHistory.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', padding: 16 }}>{t('balance.noSettlements')}</p>
          ) : settleHistory.map((s: any) => (
            <div key={s.id} style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>{t('balance.settledOn')} {new Date(s.created_at).toLocaleDateString(locale)} {t('balance.by')} {s.settled_by_name ?? t('common.unknown')}</p>
              {s.expenses?.map((item: any) => item.expense ? (
                <div key={item.expense_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text)', marginTop: 6, padding: '4px 0', borderTop: '1px solid var(--color-border)' }}>
                  <span>{item.expense.title}</span>
                  <span style={{ fontWeight: 500 }}>{formatAmount(Number(item.expense.amount), currency)}</span>
                </div>
              ) : null)}
              {s.transfers?.length > 0 && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
                  {s.transfers.map((tr: any, i: number) => (
                    <p key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0' }}>
                      {tr.from_name ?? t('common.unknown')} → {tr.to_name ?? t('common.unknown')}: {formatAmount(Number(tr.amount), currency)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </DsModal>
    </div>
  )
}

// ─── Settings Tab ───────────────────────────────────────────────────────

function SettingsTab({ groupId, group, tags, loading, onRefresh, availableMembers, onMembersUpdate }: {
  groupId: string; group: GroupDetail; tags: Tag[]; loading: boolean; onRefresh: () => void;
  availableMembers: { id: string; display_name: string }[]; onMembersUpdate: () => void;
}) {
  const t = useTranslations('apps.split-expenses')
  return (
    <div className="space-y-8">
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>{t('member.list.title')}</h3>
        <MembersTab groupId={groupId} members={group.members ?? []} availableMembers={availableMembers} onUpdate={onMembersUpdate} />
      </div>
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>{t('tag.list.title')}</h3>
        <TagsTab groupId={groupId} tags={tags} loading={loading} onRefresh={onRefresh} />
      </div>
    </div>
  )
}

// ─── Members Tab ────────────────────────────────────────────────────────

function MembersTab({ groupId, members, availableMembers, onUpdate }: {
  groupId: string; members: Member[]; availableMembers: { id: string; display_name: string }[]; onUpdate: () => void;
}) {
  const ctx = useAppContext()
  const t = useTranslations('apps.split-expenses')
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState('')

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
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{t('member.list.title')}</h3>
        <DsButton color="#10B981" onClick={() => setShowAdd(true)}><Users size={14} /> {t('member.list.add')}</DsButton>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {members.map(m => (
          <DsCard key={m.id} padding="sm" hover={false}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <DsAvatar size={28}>{m.display_name?.[0] ?? '?'}</DsAvatar>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', flex: 1 }}>{m.display_name ?? t('common.unknown')}</span>
              <DsToggle checked={m.active} onChange={(val) => handleToggle(m.id, val)} />
              <DsButton variant="ghost" size="sm" style={{ color: '#EF4444' }} onClick={() => handleRemove(m.id)}><Trash2 size={12} /></DsButton>
            </div>
          </DsCard>
        ))}
      </div>

      <DsModal open={showAdd} onClose={() => setShowAdd(false)} title={t('member.addModal.title')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {availableMembers.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', padding: 16 }}>{t('member.addModal.noMembers')}</p>
          ) : (
            <>
              <select value={selected} onChange={e => setSelected(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-card text-foreground"
              >
                <option value="">{t('member.addModal.placeholder')}</option>
                {availableMembers.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <DsButton variant="ghost" onClick={() => setShowAdd(false)}>{t('common.cancel')}</DsButton>
                <DsButton color="#10B981" disabled={adding || !selected} onClick={handleAdd}>
                  {adding && <Loader2 className="w-3 h-3 animate-spin" />}{t('member.addModal.confirm')}
                </DsButton>
              </div>
            </>
          )}
        </div>
      </DsModal>
    </div>
  )
}

// ─── Tags Tab ───────────────────────────────────────────────────────────

function TagsTab({ groupId, tags, loading, onRefresh }: {
  groupId: string; tags: Tag[]; loading: boolean; onRefresh: () => void;
}) {
  const ctx = useAppContext()
  const t = useTranslations('apps.split-expenses')
  const [editTag, setEditTag] = useState<Tag | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#10B981')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!newName.trim() || !ctx.groupSlug) return
    setSaving(true)
    try {
      if (editTag) {
        await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/tags/${editTag.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim(), color: newColor }),
        })
      } else {
        await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/tags`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim(), color: newColor }),
        })
      }
      setShowCreate(false); setEditTag(null); setNewName(''); setNewColor('#10B981')
      onRefresh()
    } catch {} finally { setSaving(false) }
  }

  async function handleDelete(tagId: string) {
    if (!ctx.groupSlug) return
    await fetchWithAuth(`/api/v1/${ctx.groupSlug}/apps/split-expenses/${groupId}/tags/${tagId}`, { method: 'DELETE' })
    onRefresh()
  }

  if (loading) return <DsSkeleton height={48} count={3} />

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{t('tag.list.title')}</h3>
        <DsButton color="#10B981" size="sm" onClick={() => { setEditTag(null); setNewName(''); setNewColor('#10B981'); setShowCreate(true) }}>
          <Plus size={14} /> {t('tag.create.title')}
        </DsButton>
      </div>

      {tags.length === 0 ? (
        <DsEmptyState title={t('tag.list.empty')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tags.map(tag => (
            <DsCard key={tag.id} padding="sm" hover={false}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: tag.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', flex: 1 }}>{tag.name}</span>
                <DsButton variant="ghost" size="sm" onClick={() => { setEditTag(tag); setNewName(tag.name); setNewColor(tag.color); setShowCreate(true) }}>
                  <Pencil size={12} />
                </DsButton>
                <DsButton variant="ghost" size="sm" style={{ color: '#EF4444' }} onClick={() => handleDelete(tag.id)}>
                  <Trash2 size={12} />
                </DsButton>
              </div>
            </DsCard>
          ))}
        </div>
      )}

      <DsModal open={showCreate} onClose={() => { setShowCreate(false); setEditTag(null) }} title={editTag ? t('tag.create.editTitle') : t('tag.create.title')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>{t('tag.create.name')}</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('tag.create.name')}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-card text-foreground"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>{t('tag.create.color')}</label>
            <input value={newColor} onChange={e => setNewColor(e.target.value)} type="color" className="w-10 h-10 p-0.5 border border-border rounded cursor-pointer" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <DsButton variant="ghost" onClick={() => { setShowCreate(false); setEditTag(null) }}>{t('common.cancel')}</DsButton>
            <DsButton color="#10B981" disabled={saving || !newName.trim()} onClick={handleSave}>
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}{editTag ? t('tag.create.save') : t('tag.create.confirm')}
            </DsButton>
          </div>
        </div>
      </DsModal>
    </div>
  )
}

// ─── Stats Tab ──────────────────────────────────────────────────────────

function StatsTab({ statsData, tags, period, tagId, loading, onPeriodChange, onTagIdChange }: {
  statsData: { byPeriod: { label: string; total: number }[]; cumulative: { label: string; total: number }[] };
  tags: Tag[]; period: string; tagId: string; loading: boolean;
  onPeriodChange: (p: string) => void; onTagIdChange: (id: string) => void;
}) {
  const t = useTranslations('apps.split-expenses')
  const [mode, setMode] = useState<'byPeriod' | 'cumulative'>('byPeriod')

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex bg-muted rounded-lg p-0.5">
          {(['byPeriod', 'cumulative'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >{t(`stats.${m}`)}</button>
          ))}
        </div>
        <select value={period} onChange={e => onPeriodChange(e.target.value)} className="px-2 py-1 text-xs border border-border rounded-lg bg-card text-foreground ml-auto">
          <option value="day">{t('stats.day')}</option>
          <option value="week">{t('stats.week')}</option>
          <option value="month">{t('stats.month')}</option>
          <option value="year">{t('stats.year')}</option>
        </select>
        <select value={tagId} onChange={e => onTagIdChange(e.target.value)} className="px-2 py-1 text-xs border border-border rounded-lg bg-card text-foreground">
          <option value="">{t('stats.filterTag')}</option>
          {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-8"><DsSkeleton height={200} /></div>
      ) : statsData.byPeriod.length === 0 ? (
        <DsEmptyState title={t('stats.noData')} />
      ) : (
        <BarChart
            data={chartData(mode === 'byPeriod' ? statsData.byPeriod : statsData.cumulative, mode === 'cumulative').map(d => ({ label: d.label.length > 5 ? d.label.slice(0, 5) : d.label, value: Math.round(d.total) }))}
            color="#10B981" height={200} showLine />
      )}
    </div>
  )
}
