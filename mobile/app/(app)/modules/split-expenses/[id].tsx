import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Switch,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams, Stack } from 'expo-router'
import { useTranslation } from '@/hooks/useTranslation'
import { useSplitExpenses } from '@/hooks/useSplitExpenses'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { EmptyState } from '@/components/EmptyState'
import { DsTabs } from '@/components/ds/DsTabs'
import { DsAvatar } from '@/components/ds/DsAvatar'
import { DsBadge } from '@/components/ds/DsBadge'
import { DsConfirmModal } from '@/components/ds/DsConfirmModal'
import { DsModal } from '@/components/ds/DsModal'
import { DsInput } from '@/components/ds/DsInput'
import type { Expense, Transfer, Balance, SuggestedTransfer, Tag, Member, StatEntry } from '@/lib/api-helpers-types'

const TAG_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6',
  '#EC4899', '#6B7280', '#1E293B', '#78716C',
]

export default function SplitExpensesGroupScreen() {
  const { t } = useTranslation()
  const { id: groupId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const hook = useSplitExpenses(groupId)

  const TABS = [
    { key: 'expenses', label: t('mobile.splitExpenses.expenses') },
    { key: 'balances', label: t('mobile.splitExpenses.balances') },
    { key: 'stats', label: t('mobile.splitExpenses.stats') },
    { key: 'settings', label: t('mobile.splitExpenses.settings') },
  ]

  const STATS_PERIODS = [
    { key: 'day', label: t('mobile.splitExpenses.day') },
    { key: 'week', label: t('mobile.splitExpenses.week') },
    { key: 'month', label: t('mobile.splitExpenses.month') },
    { key: 'year', label: t('mobile.splitExpenses.year') },
  ] as const

  const {
    currentGroup,
    currentGroupLoading,
    expenses,
    expensesLoading,
    expensesPagination,
    loadExpenses,
    balances,
    suggestedTransfers,
    balancesLoading,
    settleUp,
    recordPayment,
    members,
    membersLoading,
    tags,
    tagsLoading,
    transfers,
    transfersLoading,
    loadTransfers,
    stats,
    statsLoading,
    loadStats,
    refreshAll,
    formatAmount,
    // Mutations
    deleteExpense,
    toggleMember,
    removeMember,
    createTag,
    deleteTag,
    deleteTransfer,
  } = hook

  const [activeTab, setActiveTab] = useState('expenses')
  const [refreshing, setRefreshing] = useState(false)

  // Expenses tab state
  const [showFilters, setShowFilters] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'expenses' | 'transfers'>('all')
  const [filterTagId, setFilterTagId] = useState('')
  const [filterPaidBy, setFilterPaidBy] = useState('')
  const [filterMyExpenses, setFilterMyExpenses] = useState(false)
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [expensePage, setExpensePage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)

  // Stats state
  const [statsPeriod, setStatsPeriod] = useState<string>('month')
  const [statsTagId, setStatsTagId] = useState('')
  const [statsDateFrom, setStatsDateFrom] = useState('')
  const [statsDateTo, setStatsDateTo] = useState('')

  // Settings modals
  const [showAddTag, setShowAddTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#10B981')
  const [savingTag, setSavingTag] = useState(false)
  const [settlingUp, setSettlingUp] = useState(false)
  const [showSettleConfirm, setShowSettleConfirm] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState<SuggestedTransfer | null>(null)
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'expense' | 'tag' | 'member' | 'transfer'
    id: string
    name: string
  } | null>(null)

  useEffect(() => {
    if (groupId) {
      refreshAll()
    }
  }, [groupId, refreshAll])

  // Guard to avoid re-fetching stats when group hasn't changed
  const prevGroupForStats = useRef<string | null>(null)

  useEffect(() => {
    if (statsPeriod || statsTagId || statsDateFrom || statsDateTo) {
      if (prevGroupForStats.current !== groupId) {
        prevGroupForStats.current = groupId
        loadStats({
          period: statsPeriod as 'day' | 'week' | 'month' | 'year',
          tag_id: statsTagId || undefined,
          date_from: statsDateFrom || undefined,
          date_to: statsDateTo || undefined,
        })
      }
    }
  }, [groupId, statsPeriod, statsTagId, statsDateFrom, statsDateTo, loadStats])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshAll()
    setRefreshing(false)
  }, [refreshAll])

  // ── Expenses: grouped by month ──

  const applyExpenseFilters = useCallback(
    (items: Expense[]) => {
      let filtered = items
      if (filterTagId) filtered = filtered.filter((e) => e.tag_id === filterTagId)
      if (filterPaidBy) filtered = filtered.filter((e) => e.paid_by === filterPaidBy)
      // Date filtering is done server-side via loadExpenses params
      return filtered
    },
    [filterTagId, filterPaidBy],
  )

  const applyTransferFilters = useCallback(
    (items: Transfer[]) => {
      // Date filtering is done server-side via loadTransfers params
      return items
    },
    [],
  )

  const unifiedTimeline = useCallback(() => {
    const expItems = (filterType === 'all' || filterType === 'expenses')
      ? applyExpenseFilters(expenses).map((e) => ({ type: 'expense' as const, data: e, date: e.created_at }))
      : []
    const tfItems = (filterType === 'all' || filterType === 'transfers')
      ? applyTransferFilters(transfers)
          .filter((t) => t.status === 'completed')
          .map((t) => ({ type: 'transfer' as const, data: t, date: t.created_at }))
      : []
    return [...expItems, ...tfItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
  }, [expenses, transfers, filterType, applyExpenseFilters, applyTransferFilters])

  const groupedTimeline = useCallback(() => {
    const items = unifiedTimeline()
    const groups: { month: string; items: typeof items }[] = []
    for (const item of items) {
      const d = new Date(item.date)
      const label = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
      const last = groups[groups.length - 1]
      if (last && last.month === label) {
        last.items.push(item)
      } else {
        groups.push({ month: label, items: [item] })
      }
    }
    return groups
  }, [unifiedTimeline])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || expensesPagination.page >= expensesPagination.total_pages) return
    setLoadingMore(true)
    const nextPage = expensePage + 1
    setExpensePage(nextPage)
    await loadExpenses({
      page: nextPage,
      tag_id: filterTagId || undefined,
      paid_by: filterPaidBy || undefined,
      my_only: filterMyExpenses || undefined,
      date_from: filterDateFrom || undefined,
      date_to: filterDateTo || undefined,
    })
    setLoadingMore(false)
  }  , [loadingMore, expensePage, expensesPagination, loadExpenses, filterTagId, filterPaidBy, filterMyExpenses, filterDateFrom, filterDateTo])

  const applyDateFilters = useCallback(() => {
    setExpensePage(1)
    loadExpenses({
      page: 1,
      tag_id: filterTagId || undefined,
      paid_by: filterPaidBy || undefined,
      my_only: filterMyExpenses || undefined,
      date_from: filterDateFrom || undefined,
      date_to: filterDateTo || undefined,
    })
    loadTransfers({
      date_from: filterDateFrom || undefined,
      date_to: filterDateTo || undefined,
    })
    setShowFilters(false)
  }, [loadExpenses, loadTransfers, filterTagId, filterPaidBy, filterMyExpenses, filterDateFrom, filterDateTo])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm || !groupId) return
    switch (deleteConfirm.type) {
      case 'expense':
        await deleteExpense(deleteConfirm.id)
        break
      case 'tag':
        await deleteTag(deleteConfirm.id)
        break
      case 'member':
        await removeMember(deleteConfirm.id)
        break
      case 'transfer':
        await deleteTransfer(deleteConfirm.id)
        break
    }
    setDeleteConfirm(null)
  }, [deleteConfirm, groupId, deleteExpense, deleteTag, removeMember, deleteTransfer])

  const handleSettleUp = useCallback(async () => {
    setSettlingUp(true)
    setShowSettleConfirm(false)
    await settleUp()
    setSettlingUp(false)
  }, [settleUp])

  const handleRecordPayment = useCallback(async () => {
    if (!paymentTarget) return
    setShowPaymentConfirm(false)
    await recordPayment({
      from_user: paymentTarget.from_user,
      to_user: paymentTarget.to_user,
      amount: paymentTarget.amount,
    })
    setPaymentTarget(null)
  }, [paymentTarget, recordPayment])

  const handleAddTag = useCallback(async () => {
    if (!newTagName.trim()) return
    setSavingTag(true)
    await createTag({ name: newTagName.trim(), color: newTagColor })
    setSavingTag(false)
    setShowAddTag(false)
    setNewTagName('')
    setNewTagColor('#10B981')
  }, [newTagName, newTagColor, createTag])

  // ── Loading ──

  if (currentGroupLoading && !currentGroup) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950 px-4 pt-4">
        <LoadingSkeleton type="detail" />
      </View>
    )
  }

  if (!currentGroup && !currentGroupLoading) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <Stack.Screen options={{ title: t('mobile.splitExpenses.groupTitle') }} />
        <EmptyState
          icon="🔍"
          title={t('mobile.splitExpenses.loadError')}
          message="This expense group may have been deleted or you don't have access."
          action={{ label: t('mobile.splitExpenses.goBack'), onPress: () => router.back() }}
        />
      </View>
    )
  }

  const group = currentGroup!
  const currency = group.currency || 'EUR'

  // ── Render ──

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <Stack.Screen options={{ title: group.title, headerBackTitle: t('mobile.splitExpenses.groupsBack') }} />

      {/* Header */}
      <View className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-slate-700 px-4 py-4">
        <View className="flex-row items-center gap-3 mb-1">
          <Text className="text-3xl">{group.emoji}</Text>
          <View className="flex-1">
            <Text className="text-lg font-bold text-slate-900 dark:text-white">
              {group.title}
            </Text>
            <Text className="text-xs text-slate-400">
              {t('mobile.splitExpenses.members', { count: members.length })} · {currency}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <DsTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === 'expenses' && (
        <ExpensesTab
          timelineGroups={groupedTimeline()}
          expensesLoading={expensesLoading || transfersLoading}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onLoadMore={handleLoadMore}
          loadingMore={loadingMore}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          filterType={filterType}
          setFilterType={setFilterType}
          filterTagId={filterTagId}
          setFilterTagId={setFilterTagId}
          filterPaidBy={filterPaidBy}
          setFilterPaidBy={setFilterPaidBy}
          filterMyExpenses={filterMyExpenses}
          setFilterMyExpenses={setFilterMyExpenses}
          filterDateFrom={filterDateFrom}
          setFilterDateFrom={setFilterDateFrom}
          filterDateTo={filterDateTo}
          setFilterDateTo={setFilterDateTo}
          applyDateFilters={applyDateFilters}
          tags={tags}
          members={members}
          formatAmount={formatAmount}
          currency={currency}
          groupId={groupId!}
          router={router}
          onExpensePress={(expense) => router.push(`/(app)/modules/split-expenses/${groupId}/expense/${expense.id}`)}
          onDeleteExpense={(id, name) => setDeleteConfirm({ type: 'expense', id, name })}
          onTransferPress={(transfer) => {
            router.push({
              pathname: `/(app)/modules/split-expenses/${groupId}/transfer`,
              params: { transferId: transfer.id },
            })
          }}
        />
      )}

      {activeTab === 'balances' && (
        <BalancesTab
          balances={balances}
          suggestedTransfers={suggestedTransfers}
          balancesLoading={balancesLoading}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          formatAmount={formatAmount}
          currency={currency}
          settleUp={() => setShowSettleConfirm(true)}
          settlingUp={settlingUp}
          onRecordPayment={(t) => {
            setPaymentTarget(t)
            setShowPaymentConfirm(true)
          }}
          groupId={groupId!}
          router={router}
        />
      )}

      {activeTab === 'stats' && (
        <StatsTab
          stats={stats}
          statsLoading={statsLoading}
          statsPeriod={statsPeriod}
          setStatsPeriod={setStatsPeriod}
          statsTagId={statsTagId}
          setStatsTagId={setStatsTagId}
          statsDateFrom={statsDateFrom}
          setStatsDateFrom={setStatsDateFrom}
          statsDateTo={statsDateTo}
          setStatsDateTo={setStatsDateTo}
          tags={tags}
          formatAmount={formatAmount}
          currency={currency}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab
          members={members}
          tags={tags}
          membersLoading={membersLoading}
          tagsLoading={tagsLoading}
          onToggleMember={toggleMember}
          onRemoveMember={(id, name) => setDeleteConfirm({ type: 'member', id, name })}
          onDeleteTag={(id, name) => setDeleteConfirm({ type: 'tag', id, name })}
          showAddTag={showAddTag}
          setShowAddTag={setShowAddTag}
          newTagName={newTagName}
          setNewTagName={setNewTagName}
          newTagColor={newTagColor}
          setNewTagColor={setNewTagColor}
          savingTag={savingTag}
          handleAddTag={handleAddTag}
        />
      )}

      {/* FAB for expenses tab */}
      {activeTab === 'expenses' && (
        <TouchableOpacity
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
          onPress={() =>
            router.push(`/(app)/modules/split-expenses/${groupId}/expense/new`)
          }
          activeOpacity={0.8}
        >
          <Text className="text-white text-2xl font-bold">+</Text>
        </TouchableOpacity>
      )}

      {/* Settle All confirm */}
      <DsConfirmModal
        open={showSettleConfirm}
        onClose={() => setShowSettleConfirm(false)}
        title={t('mobile.splitExpenses.settleAll')}
        message={t('mobile.splitExpenses.settleConfirmDesc')}
        confirmLabel={t('mobile.splitExpenses.settleAll')}
        variant="success"
        onConfirm={handleSettleUp}
      />

      {/* Record payment confirm */}
      <DsConfirmModal
        open={showPaymentConfirm}
        onClose={() => {
          setShowPaymentConfirm(false)
          setPaymentTarget(null)
        }}
        title={t('mobile.splitExpenses.payConfirm')}
        message={
          paymentTarget
            ? `Confirm payment of ${formatAmount(paymentTarget.amount, currency)} from ${paymentTarget.from_name || 'user'} to ${paymentTarget.to_name || 'user'}?`
            : ''
        }
        confirmLabel="Confirm"
        variant="success"
        onConfirm={handleRecordPayment}
      />

      {/* Delete confirm */}
      <DsConfirmModal
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title={`${t('mobile.splitExpenses.delete')} ${deleteConfirm?.type || ''}`}
        message={`Are you sure you want to delete "${deleteConfirm?.name || ''}"? This cannot be undone.`}
        confirmLabel={t('mobile.splitExpenses.delete')}
        variant="danger"
        onConfirm={handleDeleteConfirm}
      />
    </View>
  )
}

// ── Expenses Tab ──

function ExpensesTab({
  timelineGroups,
  expensesLoading,
  onRefresh,
  refreshing,
  onLoadMore,
  loadingMore,
  showFilters,
  setShowFilters,
  filterType,
  setFilterType,
  filterTagId,
  setFilterTagId,
  filterPaidBy,
  setFilterPaidBy,
  filterMyExpenses,
  setFilterMyExpenses,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  applyDateFilters,
  tags,
  members,
  formatAmount,
  currency,
  groupId,
  router,
  onExpensePress,
  onDeleteExpense,
  onTransferPress,
}: {
  timelineGroups: { month: string; items: { type: 'expense' | 'transfer'; data: Expense | Transfer; date: string }[] }[]
  expensesLoading: boolean
  onRefresh: () => void
  refreshing: boolean
  onLoadMore: () => void
  loadingMore: boolean
  showFilters: boolean
  setShowFilters: (v: boolean) => void
  filterType: 'all' | 'expenses' | 'transfers'
  setFilterType: (v: 'all' | 'expenses' | 'transfers') => void
  filterTagId: string
  setFilterTagId: (v: string) => void
  filterPaidBy: string
  setFilterPaidBy: (v: string) => void
  filterMyExpenses: boolean
  setFilterMyExpenses: (v: boolean) => void
  filterDateFrom: string
  setFilterDateFrom: (v: string) => void
  filterDateTo: string
  setFilterDateTo: (v: string) => void
  applyDateFilters: () => void
  tags: Tag[]
  members: Member[]
  formatAmount: (amount: number, currency?: string) => string
  currency: string
  groupId: string
  router: ReturnType<typeof useRouter>
  onExpensePress: (expense: Expense) => void
  onDeleteExpense: (id: string, name: string) => void
  onTransferPress: (transfer: Transfer) => void
}) {
  const { t } = useTranslation()
  const activeFilters =
    (filterTagId ? 1 : 0) +
    (filterPaidBy ? 1 : 0) +
    (filterMyExpenses ? 1 : 0) +
    (filterDateFrom || filterDateTo ? 1 : 0)

  const flatData = timelineGroups.flatMap((g) => [
    { kind: 'header' as const, month: g.month },
    ...g.items.map((item) => ({
      kind: item.type,
      data: item.data,
      date: item.date,
    })),
  ])

  const renderItem = useCallback(
    ({ item }: { item: (typeof flatData)[number] }) => {
      if (item.kind === 'header') {
        return (
          <View className="px-4 pt-4 pb-2">
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {item.month}
            </Text>
          </View>
        )
      }

      if (item.kind === 'expense') {
        const exp = item.data as Expense
        const tag = exp.tag_id ? tags.find((t) => t.id === exp.tag_id) : null
        return (
          <TouchableOpacity
            className="bg-white dark:bg-gray-900 mx-4 mb-2 rounded-xl border border-slate-100 dark:border-slate-800 p-3"
            onPress={() => onExpensePress(exp)}
            activeOpacity={0.7}
            onLongPress={() => onDeleteExpense(exp.id, exp.title)}
          >
            <View className="flex-row items-center gap-3">
              <DsAvatar
                name={exp.paid_by_profile?.display_name || '?'}
                size="sm"
              />
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-slate-900 dark:text-white flex-1">
                    {exp.title}
                  </Text>
                  <Text className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatAmount(exp.amount, currency)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2 mt-0.5">
                  <Text className="text-xs text-slate-400">
                    {exp.paid_by_profile?.display_name || 'Someone'}
                  </Text>
                  {tag && (
                    <DsBadge label={tag.name} variant="primary" />
                  )}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )
      }

      // Transfer
      const tf = item.data as Transfer
      return (
        <TouchableOpacity
          className="bg-white dark:bg-gray-900 mx-4 mb-2 rounded-xl border border-slate-100 dark:border-slate-800 p-3"
          onPress={() => onTransferPress(tf)}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center gap-2">
            <Text className="text-lg">💸</Text>
            <View className="flex-1">
              <View className="flex-row items-center gap-1">
                <Text className="text-sm font-semibold text-slate-900 dark:text-white">
                  {tf.from_name || 'User'}
                </Text>
                <Text className="text-slate-400">→</Text>
                <Text className="text-sm font-semibold text-slate-900 dark:text-white">
                  {tf.to_name || 'User'}
                </Text>
              </View>
              {tf.note ? (
                <Text className="text-xs text-slate-400 mt-0.5">{tf.note}</Text>
              ) : null}
            </View>
            <Text className="text-sm font-bold text-emerald-600">
              {formatAmount(tf.amount, currency)}
            </Text>
          </View>
        </TouchableOpacity>
      )
    },
    [tags, currency, formatAmount, onExpensePress, onDeleteExpense, onTransferPress],
  )

  if (expensesLoading && timelineGroups.length === 0) {
    return (
      <View className="flex-1 px-4 pt-4">
        <LoadingSkeleton type="card" count={5} />
      </View>
    )
  }

  return (
    <View className="flex-1">
      {/* Filter bar */}
      <View className="flex-row items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800">
        <TouchableOpacity
          className="flex-row items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
          onPress={() => setShowFilters(!showFilters)}
          activeOpacity={0.7}
        >
          <Text className="text-sm text-slate-600 dark:text-slate-400">Filter</Text>
          {activeFilters > 0 && (
            <View className="bg-primary rounded-full w-5 h-5 items-center justify-center">
              <Text className="text-white text-xs font-bold">{activeFilters}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          className="px-3 py-2"
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <Text className="text-sm text-slate-500">Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Filter modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setShowFilters(false)}
        >
          <Pressable
            className="bg-white dark:bg-gray-900 rounded-t-2xl max-h-[85%]"
            onPress={() => {}}
          >
            <ScrollView className="p-5" keyboardShouldPersistTaps="handled">
              <Text className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                {t('mobile.splitExpenses.filterTitle')}
              </Text>

              {/* Type */}
              <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Type
              </Text>
              <View className="flex-row gap-2 mb-4">
                {([
                  { key: 'all', label: t('mobile.splitExpenses.filterAll') },
                  { key: 'expenses', label: t('mobile.splitExpenses.filterExpenses') },
                  { key: 'transfers', label: t('mobile.splitExpenses.filterTransfers') },
                ] as const).map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    className={`px-4 py-2 rounded-xl ${
                      filterType === opt.key
                        ? 'bg-primary'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                    onPress={() => setFilterType(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        filterType === opt.key ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tag filter */}
              <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tag
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className={`px-3 py-2 rounded-xl ${
                      filterTagId === ''
                        ? 'bg-primary'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                    onPress={() => setFilterTagId('')}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        filterTagId === '' ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {t('mobile.splitExpenses.filterAll')}
                    </Text>
                  </TouchableOpacity>
                  {tags.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      className={`px-3 py-2 rounded-xl ${
                        filterTagId === t.id
                          ? 'bg-primary'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                      onPress={() => setFilterTagId(t.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          filterTagId === t.id ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Paid by */}
              <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('mobile.splitExpenses.expensePaidBy')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className={`px-3 py-2 rounded-xl ${
                      filterPaidBy === ''
                        ? 'bg-primary'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                    onPress={() => setFilterPaidBy('')}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        filterPaidBy === '' ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Anyone
                    </Text>
                  </TouchableOpacity>
                  {members.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      className={`px-3 py-2 rounded-xl ${
                        filterPaidBy === m.user_id
                          ? 'bg-primary'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                      onPress={() => setFilterPaidBy(m.user_id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          filterPaidBy === m.user_id ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {m.display_name || 'User'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* My expenses only */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('mobile.splitExpenses.myExpensesOnly')}
                </Text>
                <Switch
                  value={filterMyExpenses}
                  onValueChange={setFilterMyExpenses}
                  trackColor={{ false: '#CBD5E1', true: '#9B1C1C' }}
                />
              </View>

              {/* Date range */}
              <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Date range
              </Text>
              <View className="flex-row gap-2 mb-4">
                <View className="flex-1">
                  <TextInput
                    className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-gray-900"
                    value={filterDateFrom}
                    onChangeText={setFilterDateFrom}
                    placeholder="From (YYYY-MM-DD)"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View className="flex-1">
                  <TextInput
                    className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-gray-900"
                    value={filterDateTo}
                    onChangeText={setFilterDateTo}
                    placeholder="To (YYYY-MM-DD)"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Apply */}
              <TouchableOpacity
                className="bg-primary rounded-xl py-3 items-center"
                onPress={applyDateFilters}
                activeOpacity={0.8}
              >
                <Text className="text-white text-sm font-semibold">Apply Filters</Text>
              </TouchableOpacity>

              <View className="h-8" />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* List */}
      {flatData.length === 0 && !expensesLoading ? (
        <EmptyState
          icon="🧾"
          title="No expenses yet"
          message="Add your first expense to start tracking who owes what."
          action={{
            label: t('mobile.splitExpenses.addExpense'),
            onPress: () => router.push(`/(app)/modules/split-expenses/${groupId}/expense/new`),
          }}
        />
      ) : (
        <FlatList
          data={flatData}
          renderItem={renderItem}
          keyExtractor={(item, index) => {
            if (item.kind === 'header') return `h-${item.month}`
            const id = 'data' in item && item.data && 'id' in item.data ? (item.data as { id: string }).id : index
            return `${item.kind}-${id}-${index}`
          }}
          contentContainerStyle={{ paddingBottom: 80, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9B1C1C" />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#9B1C1C" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  )
}

// ── Balances Tab ──

function BalancesTab({
  balances,
  suggestedTransfers,
  balancesLoading,
  onRefresh,
  refreshing,
  formatAmount,
  currency,
  settleUp,
  settlingUp,
  onRecordPayment,
  groupId,
  router,
}: {
  balances: Balance[]
  suggestedTransfers: SuggestedTransfer[]
  balancesLoading: boolean
  onRefresh: () => void
  refreshing: boolean
  formatAmount: (amount: number, currency?: string) => string
  currency: string
  settleUp: () => void
  settlingUp: boolean
  onRecordPayment: (t: SuggestedTransfer) => void
  groupId: string
  router: ReturnType<typeof useRouter>
}) {
  const { t } = useTranslation()
  if (balancesLoading && balances.length === 0) {
    return (
      <View className="flex-1 px-4 pt-4">
        <LoadingSkeleton type="list" count={4} />
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9B1C1C" />
      }
      contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
    >
      {/* Balances */}
      <View className="p-4">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Current Balances
        </Text>
        {balances.length === 0 ? (
          <Text className="text-sm text-slate-400 py-4">{t('mobile.splitExpenses.balanceEven')}</Text>
        ) : (
          balances.map((b) => (
            <View
              key={b.user_id}
              className="flex-row items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800"
            >
              <View className="flex-row items-center gap-2">
                <DsAvatar name={b.display_name || '?'} size="sm" />
                <Text className="text-sm font-medium text-slate-900 dark:text-white">
                  {b.display_name || 'User'}
                </Text>
              </View>
              <Text
                className="text-sm font-bold"
                style={{
                  color:
                    b.net_balance > 0
                      ? '#10B981'
                      : b.net_balance < 0
                        ? '#DC2626'
                        : '#64748B',
                }}
              >
                {b.net_balance > 0 ? '+' : ''}
                {formatAmount(b.net_balance, currency)}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Suggested Transfers */}
      {suggestedTransfers.length > 0 && (
        <View className="px-4 pb-4">
          <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Suggested Transfers
          </Text>
          {suggestedTransfers.map((t, i) => (
            <View
              key={`${t.from_user}-${t.to_user}-${i}`}
              className="flex-row items-center gap-3 bg-white dark:bg-gray-900 rounded-xl border border-slate-100 dark:border-slate-800 p-3 mb-2"
            >
              <View className="flex-1">
                <View className="flex-row items-center gap-1">
                  <Text className="text-sm font-medium text-slate-900 dark:text-white">
                    {t.from_name || 'User'}
                  </Text>
                  <Text className="text-slate-400">→</Text>
                  <Text className="text-sm font-medium text-slate-900 dark:text-white">
                    {t.to_name || 'User'}
                  </Text>
                </View>
                <Text className="text-xs text-slate-400 mt-0.5">
                  {formatAmount(t.amount, currency)}
                </Text>
              </View>
              <TouchableOpacity
                className="bg-emerald-500 rounded-lg px-3 py-2"
                onPress={() => onRecordPayment(t)}
                activeOpacity={0.7}
              >
                <Text className="text-white text-xs font-semibold">Paid</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Settle all */}
      {balances.length > 0 && (
        <View className="px-4 pb-8">
          <TouchableOpacity
            className={`rounded-xl py-3.5 items-center ${
              settlingUp ? 'bg-emerald-500/50' : 'bg-emerald-500'
            }`}
            onPress={settleUp}
            disabled={settlingUp}
            activeOpacity={0.8}
          >
            <Text className="text-white text-sm font-bold">
              {settlingUp ? t('mobile.splitExpenses.settling') : t('mobile.splitExpenses.settleAll')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add manual transfer */}
      <View className="px-4 pb-8">
        <TouchableOpacity
          className="rounded-xl py-3.5 items-center border border-slate-200 dark:border-slate-700"
          onPress={() => router.push(`/(app)/modules/split-expenses/${groupId}/transfer`)}
          activeOpacity={0.7}
        >
          <Text className="text-slate-600 dark:text-slate-400 text-sm font-semibold">
            Manual Transfer
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// ── Stats Tab ──

function StatsTab({
  stats,
  statsLoading,
  statsPeriod,
  setStatsPeriod,
  statsTagId,
  setStatsTagId,
  statsDateFrom,
  setStatsDateFrom,
  statsDateTo,
  setStatsDateTo,
  tags,
  formatAmount,
  currency,
}: {
  stats: StatEntry[]
  statsLoading: boolean
  statsPeriod: string
  setStatsPeriod: (v: string) => void
  statsTagId: string
  setStatsTagId: (v: string) => void
  statsDateFrom: string
  setStatsDateFrom: (v: string) => void
  statsDateTo: string
  setStatsDateTo: (v: string) => void
  tags: Tag[]
  formatAmount: (amount: number, currency?: string) => string
  currency: string
}) {
  const { t } = useTranslation()
  const maxValue = stats.length > 0 ? Math.max(...stats.map((s) => s.total)) : 0

  const STATS_PERIODS = [
    { key: 'day', label: t('mobile.splitExpenses.day') },
    { key: 'week', label: t('mobile.splitExpenses.week') },
    { key: 'month', label: t('mobile.splitExpenses.month') },
    { key: 'year', label: t('mobile.splitExpenses.year') },
  ] as const

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Period selector */}
      <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Period
      </Text>
      <View className="flex-row gap-2 mb-4">
        {STATS_PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            className={`flex-1 py-2 rounded-xl items-center ${
              statsPeriod === p.key
                ? 'bg-primary'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
            onPress={() => setStatsPeriod(p.key)}
            activeOpacity={0.7}
          >
            <Text
              className={`text-xs font-semibold ${
                statsPeriod === p.key ? 'text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tag filter */}
      <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Tag
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        <View className="flex-row gap-2">
          <TouchableOpacity
            className={`px-3 py-2 rounded-xl ${
              statsTagId === ''
                ? 'bg-primary'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
            onPress={() => setStatsTagId('')}
            activeOpacity={0.7}
          >
            <Text
              className={`text-xs font-semibold ${
                statsTagId === '' ? 'text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t('mobile.splitExpenses.filterAll')}
            </Text>
          </TouchableOpacity>
          {tags.map((t) => (
            <TouchableOpacity
              key={t.id}
              className={`px-3 py-2 rounded-xl ${
                statsTagId === t.id
                  ? 'bg-primary'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
              onPress={() => setStatsTagId(t.id)}
              activeOpacity={0.7}
            >
              <Text
                className={`text-xs font-semibold ${
                  statsTagId === t.id ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Date range */}
      <View className="flex-row gap-2 mb-4">
        <View className="flex-1">
          <TextInput
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-gray-900"
            value={statsDateFrom}
            onChangeText={setStatsDateFrom}
            placeholder="From (YYYY-MM-DD)"
            placeholderTextColor="#94A3B8"
          />
        </View>
        <View className="flex-1">
          <TextInput
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-gray-900"
            value={statsDateTo}
            onChangeText={setStatsDateTo}
            placeholder="To (YYYY-MM-DD)"
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      {/* Bar chart */}
      {statsLoading && stats.length === 0 ? (
        <LoadingSkeleton type="list" count={4} />
      ) : stats.length === 0 ? (
        <View className="py-8 items-center">
          <Text className="text-sm text-slate-400">No data for this period</Text>
        </View>
      ) : (
        <View>
          <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Spending by {statsPeriod}
          </Text>
          {/* Total */}
          <View className="bg-white dark:bg-gray-900 rounded-xl border border-slate-100 dark:border-slate-800 p-3 mb-3">
            <Text className="text-xs text-slate-400">{t('mobile.splitExpenses.totalSpent')}</Text>
            <Text className="text-lg font-bold text-slate-900 dark:text-white">
              {formatAmount(
                stats.reduce((s, e) => s + e.total, 0),
                currency,
              )}
            </Text>
          </View>
          {/* Bars */}
          {stats.map((entry, i) => {
            const width = maxValue > 0 ? (entry.total / maxValue) * 100 : 0
            const hue = 160 - i * 20
            const color = `hsl(${Math.max(hue, 0)}, 70%, 50%)`
            return (
              <View key={entry.label} className="mb-2">
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className="text-xs text-slate-600 dark:text-slate-400 flex-1">
                    {entry.label}
                  </Text>
                  <Text className="text-xs font-semibold text-slate-900 dark:text-white ml-2 w-20 text-right">
                    {formatAmount(entry.total, currency)}
                  </Text>
                </View>
                <View className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(width, 2)}%`, backgroundColor: color }}
                  />
                </View>
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

// ── Settings Tab ──

function SettingsTab({
  members,
  tags,
  membersLoading,
  tagsLoading,
  onToggleMember,
  onRemoveMember,
  onDeleteTag,
  showAddTag,
  setShowAddTag,
  newTagName,
  setNewTagName,
  newTagColor,
  setNewTagColor,
  savingTag,
  handleAddTag,
}: {
  members: Member[]
  tags: Tag[]
  membersLoading: boolean
  tagsLoading: boolean
  onToggleMember: (id: string, active: boolean) => void
  onRemoveMember: (id: string, name: string) => void
  onDeleteTag: (id: string, name: string) => void
  showAddTag: boolean
  setShowAddTag: (v: boolean) => void
  newTagName: string
  setNewTagName: (v: string) => void
  newTagColor: string
  setNewTagColor: (v: string) => void
  savingTag: boolean
  handleAddTag: () => void
}) {
  const { t } = useTranslation()
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Members */}
      <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        {t('mobile.splitExpenses.membersTitle')} ({members.length})
      </Text>
      {membersLoading ? (
        <LoadingSkeleton type="list" count={3} />
      ) : members.length === 0 ? (
        <Text className="text-sm text-slate-400 mb-6">No members yet</Text>
      ) : (
        members.map((m) => (
          <View
            key={m.id}
            className="flex-row items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800"
          >
            <View className="flex-row items-center gap-2 flex-1">
              <DsAvatar name={m.display_name || '?'} size="sm" />
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-900 dark:text-white">
                  {m.display_name || 'User'}
                </Text>
                <Text className="text-xs text-slate-400">
                  {m.active ? t('mobile.splitExpenses.active') : t('mobile.splitExpenses.inactive')}
                </Text>
              </View>
            </View>
            <Switch
              value={m.active}
              onValueChange={(v) => onToggleMember(m.id, v)}
              trackColor={{ false: '#CBD5E1', true: '#10B981' }}
            />
            <TouchableOpacity
              className="ml-2 px-2 py-1"
              onPress={() => onRemoveMember(m.id, m.display_name || 'User')}
              activeOpacity={0.7}
            >
              <Text className="text-red-500 text-xs font-semibold">{t('mobile.splitExpenses.removeMember')}</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Tags */}
      <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        {t('mobile.splitExpenses.tagsTitle')} ({tags.length})
      </Text>
      {tagsLoading ? (
        <LoadingSkeleton type="list" count={2} />
      ) : tags.length === 0 ? (
        <Text className="text-sm text-slate-400 mb-4">No tags yet</Text>
      ) : (
        tags.map((tag) => (
          <View
            key={tag.id}
            className="flex-row items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800"
          >
            <View className="flex-row items-center gap-2">
              <View
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <Text className="text-sm font-medium text-slate-900 dark:text-white">
                {tag.name}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onDeleteTag(tag.id, tag.name)}
              activeOpacity={0.7}
            >
              <Text className="text-red-500 text-xs font-semibold">{t('mobile.splitExpenses.delete')}</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Add tag */}
      <TouchableOpacity
        className="rounded-xl py-3 items-center border border-dashed border-slate-300 dark:border-slate-600 mb-6 mt-3"
        onPress={() => setShowAddTag(true)}
        activeOpacity={0.7}
      >
        <Text className="text-primary text-sm font-semibold">+ {t('mobile.splitExpenses.addTag')}</Text>
      </TouchableOpacity>

      {/* Add Tag Modal */}
      <DsModal
        open={showAddTag}
        onClose={() => setShowAddTag(false)}
        title={t('mobile.splitExpenses.addTag')}
      >
        <View className="gap-4">
          <DsInput
            label={t('mobile.splitExpenses.tagName')}
            value={newTagName}
            onChangeText={setNewTagName}
            placeholder="e.g. Food"
          />
          <View>
            <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('mobile.splitExpenses.tagColor')}
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {TAG_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  className={`w-9 h-9 rounded-full ${
                    newTagColor === c ? 'border-2 border-slate-900 dark:border-white' : ''
                  }`}
                  style={{
                    backgroundColor: c,
                    borderWidth: newTagColor === c ? 3 : 0,
                  }}
                  onPress={() => setNewTagColor(c)}
                  activeOpacity={0.7}
                />
              ))}
            </View>
          </View>
          <View className="flex-row gap-3 justify-end pt-2">
            <TouchableOpacity
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
              onPress={() => setShowAddTag(false)}
              activeOpacity={0.7}
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t('mobile.splitExpenses.cancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-5 py-2.5 rounded-xl ${
                savingTag || !newTagName.trim()
                  ? 'bg-primary/50'
                  : 'bg-primary'
              }`}
              onPress={handleAddTag}
              disabled={savingTag || !newTagName.trim()}
              activeOpacity={0.8}
            >
              <Text className="text-white text-sm font-semibold">
                {savingTag ? t('mobile.splitExpenses.saving') : t('mobile.splitExpenses.add')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </DsModal>
    </ScrollView>
  )
}
