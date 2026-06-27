// TODO: Split into useExpenses, useMembers, useTags, useBalances, useTransfers hooks
import { useState, useEffect, useCallback, useRef } from 'react'
import * as api from '@/lib/api-helpers'
import type {
  ExpenseGroup,
  Expense,
  Member,
  Tag,
  Transfer,
  Balance,
  SuggestedTransfer,
  StatEntry,
  Pagination,
  CreateGroupInput,
  CreateExpenseInput,
  UpdateExpenseInput,
  CreateTransferInput,
  UpdateTransferInput,
} from '@/lib/api-helpers-types'

export function useSplitExpenses(groupId?: string) {
  // ── Groups ──
  const [groups, setGroups] = useState<ExpenseGroup[]>([])
  const [groupsPagination, setGroupsPagination] = useState<Pagination>(api.defaultPagination())
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsError, setGroupsError] = useState<string | null>(null)

  // ── Expenses ──
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expensesPagination, setExpensesPagination] = useState<Pagination>(api.defaultPagination())
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [expensesError, setExpensesError] = useState<string | null>(null)

  // ── Members ──
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState<string | null>(null)

  // ── Tags ──
  const [tags, setTags] = useState<Tag[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [tagsError, setTagsError] = useState<string | null>(null)

  // ── Balances ──
  const [balances, setBalances] = useState<Balance[]>([])
  const [suggestedTransfers, setSuggestedTransfers] = useState<SuggestedTransfer[]>([])
  const [balancesLoading, setBalancesLoading] = useState(false)
  const [balancesError, setBalancesError] = useState<string | null>(null)

  // ── Transfers ──
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [transfersPagination, setTransfersPagination] = useState<Pagination>(api.defaultPagination())
  const [transfersLoading, setTransfersLoading] = useState(false)
  const [transfersError, setTransfersError] = useState<string | null>(null)

  // ── Stats ──
  const [stats, setStats] = useState<StatEntry[]>([])
  const [statsCumulative, setStatsCumulative] = useState<StatEntry[]>([])
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  // ── Current group detail ──
  const [currentGroup, setCurrentGroup] = useState<ExpenseGroup | null>(null)
  const [currentGroupLoading, setCurrentGroupLoading] = useState(false)

  // Track loaded groupId to avoid re-fetches on same id
  const loadedGroupRef = useRef<string | undefined>(undefined)

  // ── Load groups (no groupId needed) ──

  const loadGroups = useCallback(
    async (params?: { page?: number; limit?: number; sort?: 'newest' | 'oldest' | 'alpha' }) => {
      setGroupsLoading(true)
      setGroupsError(null)
      try {
        const res = await api.fetchExpenseGroups(params)
        setGroups(res.data)
        setGroupsPagination(res.pagination)
      } catch (err) {
        setGroupsError(err instanceof Error ? err.message : 'Failed to load groups')
      } finally {
        setGroupsLoading(false)
      }
    },
    [],
  )

  // ── Load group-scoped data ──

  const loadExpenses = useCallback(
    async (params?: {
      page?: number
      limit?: number
      tag_id?: string
      paid_by?: string
      my_only?: boolean
      date_from?: string
      date_to?: string
      sort?: 'newest' | 'oldest' | 'amount_asc' | 'amount_desc'
    }) => {
      if (!groupId) return
      setExpensesLoading(true)
      setExpensesError(null)
      try {
        const res = await api.fetchExpenses(groupId, params)
        setExpenses(res.data)
        setExpensesPagination(res.pagination)
      } catch (err) {
        setExpensesError(err instanceof Error ? err.message : 'Failed to load expenses')
      } finally {
        setExpensesLoading(false)
      }
    },
    [groupId],
  )

  const loadMembers = useCallback(async () => {
    if (!groupId) return
    setMembersLoading(true)
    setMembersError(null)
    try {
      const data = await api.fetchMembers(groupId)
      setMembers(data)
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Failed to load members')
    } finally {
      setMembersLoading(false)
    }
  }, [groupId])

  const loadTags = useCallback(async () => {
    if (!groupId) return
    setTagsLoading(true)
    setTagsError(null)
    try {
      const data = await api.fetchTags(groupId)
      setTags(data)
    } catch (err) {
      setTagsError(err instanceof Error ? err.message : 'Failed to load tags')
    } finally {
      setTagsLoading(false)
    }
  }, [groupId])

  const loadBalances = useCallback(async () => {
    if (!groupId) return
    setBalancesLoading(true)
    setBalancesError(null)
    try {
      const res = await api.fetchBalances(groupId)
      setBalances(res.balances)
      setSuggestedTransfers(res.transfers)
    } catch (err) {
      setBalancesError(err instanceof Error ? err.message : 'Failed to load balances')
    } finally {
      setBalancesLoading(false)
    }
  }, [groupId])

  const loadTransfers = useCallback(
    async (params?: { page?: number; limit?: number; date_from?: string; date_to?: string }) => {
      if (!groupId) return
      setTransfersLoading(true)
      setTransfersError(null)
      try {
        const res = await api.fetchTransfers(groupId, params)
        setTransfers(res.data)
        setTransfersPagination(res.pagination)
      } catch (err) {
        setTransfersError(err instanceof Error ? err.message : 'Failed to load transfers')
      } finally {
        setTransfersLoading(false)
      }
    },
    [groupId],
  )

  const loadStats = useCallback(
    async (params?: {
      period?: 'day' | 'week' | 'month' | 'year'
      tag_id?: string
      date_from?: string
      date_to?: string
    }) => {
      if (!groupId) return
      setStatsLoading(true)
      setStatsError(null)
      try {
        const res = await api.fetchStats(groupId, params)
        setStats(res.byPeriod)
        setStatsCumulative(res.cumulative)
      } catch (err) {
        setStatsError(err instanceof Error ? err.message : 'Failed to load stats')
      } finally {
        setStatsLoading(false)
      }
    },
    [groupId],
  )

  const loadCurrentGroup = useCallback(async () => {
    if (!groupId) return
    setCurrentGroupLoading(true)
    try {
      const group = await api.fetchExpenseGroup(groupId)
      setCurrentGroup(group)
    } catch {
      // silently fail, group data comes from groups list too
    } finally {
      setCurrentGroupLoading(false)
    }
  }, [groupId])

  // ── Load all group-scoped data ──

  const refreshAll = useCallback(async () => {
    if (!groupId) return
    const results = await Promise.allSettled([
      loadExpenses(),
      loadMembers(),
      loadTags(),
      loadBalances(),
      loadTransfers(),
      loadStats(),
      loadCurrentGroup(),
    ])
    const names = ['expenses', 'members', 'tags', 'balances', 'transfers', 'stats', 'group']
    const failed = results
      .map((r, i) => (r.status === 'rejected' ? names[i] : null))
      .filter(Boolean)
    if (failed.length > 0) {
      console.warn('[SplitExpenses] refreshAll failed for:', failed.join(', '))
    }
  }, [groupId, loadExpenses, loadMembers, loadTags, loadBalances, loadTransfers, loadStats, loadCurrentGroup])

  // ── Auto-fetch when groupId changes ──

  useEffect(() => {
    if (groupId && groupId !== loadedGroupRef.current) {
      loadedGroupRef.current = groupId
      refreshAll()
    } else if (!groupId) {
      loadedGroupRef.current = undefined
    }
  }, [groupId, refreshAll])

  // ── Mutations: Groups ──

  const createGroup = useCallback(
    async (data: CreateGroupInput): Promise<ExpenseGroup | null> => {
      const newGroup = await api.createExpenseGroup(data)
      if (newGroup) {
        setGroups((prev) => [newGroup, ...prev])
      }
      return newGroup
    },
    [],
  )

  const updateGroup = useCallback(
    async (id: string, data: Partial<CreateGroupInput>): Promise<ExpenseGroup | null> => {
      const updated = await api.updateExpenseGroup(id, data)
      if (updated) {
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...updated } : g)))
        if (currentGroup?.id === id) setCurrentGroup((prev) => (prev ? { ...prev, ...updated } : null))
      }
      return updated
    },
    [currentGroup],
  )

  const deleteGroup = useCallback(async (id: string): Promise<boolean> => {
    const ok = await api.deleteExpenseGroup(id)
    if (ok) {
      setGroups((prev) => prev.filter((g) => g.id !== id))
    }
    return ok
  }, [])

  // ── Mutations: Expenses ──

  const createExpense = useCallback(
    async (data: CreateExpenseInput): Promise<Expense | null> => {
      if (!groupId) return null
      const newExpense = await api.createExpense(groupId, data)
      if (newExpense) {
        setExpenses((prev) => [newExpense, ...prev])
      }
      return newExpense
    },
    [groupId],
  )

  const updateExpense = useCallback(
    async (expenseId: string, data: UpdateExpenseInput): Promise<Expense | null> => {
      if (!groupId) return null
      const updated = await api.updateExpense(groupId, expenseId, data)
      if (updated) {
        setExpenses((prev) => prev.map((e) => (e.id === expenseId ? updated : e)))
      }
      return updated
    },
    [groupId],
  )

  const deleteExpense = useCallback(
    async (expenseId: string): Promise<boolean> => {
      if (!groupId) return false
      const ok = await api.deleteExpense(groupId, expenseId)
      if (ok) {
        setExpenses((prev) => prev.filter((e) => e.id !== expenseId))
      }
      return ok
    },
    [groupId],
  )

  const fetchExpense = useCallback(
    async (expenseId: string): Promise<Expense | null> => {
      if (!groupId) return null
      try {
        const expense = await api.fetchExpense(groupId, expenseId)
        setExpenses((prev) => {
          const exists = prev.find((e) => e.id === expenseId)
          if (exists) return prev.map((e) => (e.id === expenseId ? expense : e))
          return [expense, ...prev]
        })
        return expense
      } catch {
        return null
      }
    },
    [groupId],
  )

  // ── Mutations: Members ──

  const addMember = useCallback(
    async (userId: string): Promise<Member | null> => {
      if (!groupId) return null
      const newMember = await api.addMember(groupId, userId)
      if (newMember) {
        setMembers((prev) => [...prev, newMember])
      }
      return newMember
    },
    [groupId],
  )

  const toggleMember = useCallback(
    async (memberId: string, active: boolean): Promise<Member | null> => {
      if (!groupId) return null
      const updated = await api.toggleMember(groupId, memberId, active)
      if (updated) {
        setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)))
      }
      return updated
    },
    [groupId],
  )

  const removeMember = useCallback(
    async (memberId: string): Promise<boolean> => {
      if (!groupId) return false
      const ok = await api.removeMember(groupId, memberId)
      if (ok) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId))
      }
      return ok
    },
    [groupId],
  )

  // ── Mutations: Tags ──

  const createTag = useCallback(
    async (data: { name: string; color: string }): Promise<Tag | null> => {
      if (!groupId) return null
      const newTag = await api.createTag(groupId, data)
      if (newTag) {
        setTags((prev) => [...prev, newTag])
      }
      return newTag
    },
    [groupId],
  )

  const updateTag = useCallback(
    async (tagId: string, data: { name?: string; color?: string }): Promise<Tag | null> => {
      if (!groupId) return null
      const updated = await api.updateTag(groupId, tagId, data)
      if (updated) {
        setTags((prev) => prev.map((t) => (t.id === tagId ? updated : t)))
      }
      return updated
    },
    [groupId],
  )

  const deleteTag = useCallback(
    async (tagId: string): Promise<boolean> => {
      if (!groupId) return false
      const ok = await api.deleteTag(groupId, tagId)
      if (ok) {
        setTags((prev) => prev.filter((t) => t.id !== tagId))
      }
      return ok
    },
    [groupId],
  )

  // ── Mutations: Transfers ──

  const settleUp = useCallback(async (): Promise<number | null> => {
    if (!groupId) return null
    const res = await api.settleUp(groupId)
    if (res) {
      setSuggestedTransfers([])
      // Refresh balances & transfers after settle
      loadBalances()
      loadTransfers()
      return res.transfers_created
    }
    return null
  }, [groupId, loadBalances, loadTransfers])

  const recordPayment = useCallback(
    async (data: { from_user: string; to_user: string; amount: number; note?: string }): Promise<boolean> => {
      if (!groupId) return false
      const ok = await api.recordPayment(groupId, data)
      if (ok) {
        loadBalances()
        loadTransfers()
      }
      return ok
    },
    [groupId, loadBalances, loadTransfers],
  )

  const createTransfer = useCallback(
    async (data: CreateTransferInput): Promise<Transfer | null> => {
      if (!groupId) return null
      const newTransfer = await api.createTransfer(groupId, data)
      if (newTransfer) {
        setTransfers((prev) => [newTransfer, ...prev])
        loadBalances()
      }
      return newTransfer
    },
    [groupId, loadBalances],
  )

  const updateTransfer = useCallback(
    async (transferId: string, data: UpdateTransferInput): Promise<Transfer | null> => {
      if (!groupId) return null
      const updated = await api.updateTransfer(groupId, transferId, data)
      if (updated) {
        setTransfers((prev) => prev.map((t) => (t.id === transferId ? updated : t)))
        loadBalances()
      }
      return updated
    },
    [groupId, loadBalances],
  )

  const deleteTransfer = useCallback(
    async (transferId: string): Promise<boolean> => {
      if (!groupId) return false
      const ok = await api.deleteTransfer(groupId, transferId)
      if (ok) {
        setTransfers((prev) => prev.filter((t) => t.id !== transferId))
        loadBalances()
      }
      return ok
    },
    [groupId, loadBalances],
  )

  // ── Formatting helper ──

  const formatAmount = useCallback((amount: number, currency?: string): string => {
    try {
      return new Intl.NumberFormat('en', {
        style: 'currency',
        currency: currency || 'EUR',
        minimumFractionDigits: 2,
      }).format(amount)
    } catch {
      return `${currency || 'EUR'} ${amount.toFixed(2)}`
    }
  }, [])

  return {
    // Groups
    groups,
    groupsPagination,
    groupsLoading,
    groupsError,
    loadGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    currentGroup,
    currentGroupLoading,

    // Expenses
    expenses,
    expensesPagination,
    expensesLoading,
    expensesError,
    loadExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    fetchExpense,

    // Members
    members,
    membersLoading,
    membersError,
    loadMembers,
    addMember,
    toggleMember,
    removeMember,

    // Tags
    tags,
    tagsLoading,
    tagsError,
    loadTags,
    createTag,
    updateTag,
    deleteTag,

    // Balances
    balances,
    suggestedTransfers,
    balancesLoading,
    balancesError,
    loadBalances,
    settleUp,
    recordPayment,

    // Transfers
    transfers,
    transfersPagination,
    transfersLoading,
    transfersError,
    loadTransfers,
    createTransfer,
    updateTransfer,
    deleteTransfer,

    // Stats
    stats,
    statsCumulative,
    statsLoading,
    statsError,
    loadStats,

    // Utils
    refreshAll,
    formatAmount,
  }
}
