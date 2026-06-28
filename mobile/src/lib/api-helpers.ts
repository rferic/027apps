import { getServerUrl, getDefaultUrl } from './server-url'
import { getActiveGroupSlug } from './group-store'
import { getAccessToken } from './token-store'
import type {
  ExpenseGroup,
  ExpenseGroupDetail,
  Expense,
  Member,
  Tag,
  Transfer,
  PaginatedResponse,
  BalancesResponse,
  StatsResponse,
  SettleUpResponse,
  CreateGroupInput,
  CreateExpenseInput,
  UpdateExpenseInput,
  CreateTransferInput,
  UpdateTransferInput,
  Pagination,
} from './api-helpers-types'

// ── Internal fetch helper ──

async function fetchWithAuth<T>(
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string | undefined> } = {},
): Promise<T> {
  const groupSlug = await getActiveGroupSlug()
  if (!groupSlug) throw new Error('No active group')

  const baseUrl = (await getServerUrl()) || getDefaultUrl()
  const token = await getAccessToken()

  let url = `${baseUrl}/api/v1/${groupSlug}/apps/split-expenses/${path}`

  if (options.params) {
    const filtered = Object.entries(options.params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    if (filtered.length > 0) {
      url += '?' + new URLSearchParams(filtered as [string, string][]).toString()
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const errBody = await res.json()
      if (errBody?.message) message = errBody.message
    } catch { console.error('[API] Failed to parse error body') }
    throw new Error(message)
  }

  // 204 No Content — callers expecting boolean get `true`
  if (res.status === 204) return true as unknown as T

  return res.json()
}

// ── Groups ──

/**
 * Fetches all split expense groups for the current user.
 * @param params - Pagination and sort options
 * @returns Paginated list of expense groups
 */
export async function fetchExpenseGroups(
  params?: { page?: number; limit?: number; sort?: 'newest' | 'oldest' | 'alpha' },
): Promise<PaginatedResponse<ExpenseGroup>> {
  return fetchWithAuth<PaginatedResponse<ExpenseGroup>>('', {
    params: {
      page: params?.page?.toString(),
      limit: params?.limit?.toString(),
      sort: params?.sort,
    },
  })
}

/**
 * Fetches details for a single expense group.
 * @param id - Group ID
 * @returns Expense group with members, balances, and stats
 */
export async function fetchExpenseGroup(id: string): Promise<ExpenseGroupDetail> {
  return fetchWithAuth<ExpenseGroupDetail>(id)
}

/**
 * Creates a new expense group.
 * @param data - Group name, currency, and optional metadata
 * @returns The created expense group, or null on error
 */
export async function createExpenseGroup(data: CreateGroupInput): Promise<ExpenseGroup | null> {
  try {
    return await fetchWithAuth<ExpenseGroup>('', { method: 'POST', body: data })
  } catch (err) {
    console.error('[API] createExpenseGroup failed:', err)
    return null
  }
}

/**
 * Updates an existing expense group.
 * @param id - Group ID
 * @param data - Fields to update (name, currency, etc.)
 * @returns The updated expense group, or null on error
 */
export async function updateExpenseGroup(
  id: string,
  data: Partial<CreateGroupInput>,
): Promise<ExpenseGroup | null> {
  try {
    return await fetchWithAuth<ExpenseGroup>(id, { method: 'PUT', body: data })
  } catch (err) {
    console.error('[API] updateExpenseGroup failed:', err)
    return null
  }
}

/**
 * Deletes an expense group and all its data.
 * @param id - Group ID
 * @returns True if deleted successfully, false on error
 */
export async function deleteExpenseGroup(id: string): Promise<boolean> {
  try {
    await fetchWithAuth<true>(id, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('[API] deleteExpenseGroup failed:', err)
    return false
  }
}

// ── Expenses ──

/**
 * Fetches expenses for a group with pagination and filters.
 * @param groupId - Group ID
 * @param params - Pagination, tag, payer, date range, and sort options
 * @returns Paginated list of expenses
 */
export async function fetchExpenses(
  groupId: string,
  params?: {
    page?: number
    limit?: number
    tag_id?: string
    paid_by?: string
    my_only?: boolean
    date_from?: string
    date_to?: string
    sort?: 'newest' | 'oldest' | 'amount_asc' | 'amount_desc'
  },
): Promise<PaginatedResponse<Expense>> {
  return fetchWithAuth<PaginatedResponse<Expense>>(`${groupId}/expenses`, {
    params: {
      page: params?.page?.toString(),
      limit: params?.limit?.toString(),
      tag_id: params?.tag_id,
      paid_by: params?.paid_by,
      my_only: params?.my_only ? '1' : undefined,
      date_start: params?.date_from,
      date_end: params?.date_to,
      sort: params?.sort,
    },
  })
}

/**
 * Fetches a single expense by ID.
 * @param groupId - Group ID
 * @param expenseId - Expense ID
 * @returns Expense with splits and payer details
 */
export async function fetchExpense(groupId: string, expenseId: string): Promise<Expense> {
  return fetchWithAuth<Expense>(`${groupId}/expenses/${expenseId}`)
}

/**
 * Creates a new expense with splits.
 * @param groupId - Group ID
 * @param data - Expense amount, description, splits, payer, and tags
 * @returns The created expense, or null on error
 */
export async function createExpense(
  groupId: string,
  data: CreateExpenseInput,
): Promise<Expense | null> {
  try {
    return await fetchWithAuth<Expense>(`${groupId}/expenses`, { method: 'POST', body: data })
  } catch (err) {
    console.error('[API] createExpense failed:', err)
    return null
  }
}

/**
 * Updates an existing expense.
 * @param groupId - Group ID
 * @param expenseId - Expense ID
 * @param data - Fields to update (amount, description, splits, etc.)
 * @returns The updated expense, or null on error
 */
export async function updateExpense(
  groupId: string,
  expenseId: string,
  data: UpdateExpenseInput,
): Promise<Expense | null> {
  try {
    return await fetchWithAuth<Expense>(`${groupId}/expenses/${expenseId}`, {
      method: 'PUT',
      body: data,
    })
  } catch (err) {
    console.error('[API] updateExpense failed:', err)
    return null
  }
}

/**
 * Deletes an expense.
 * @param groupId - Group ID
 * @param expenseId - Expense ID
 * @returns True if deleted successfully, false on error
 */
export async function deleteExpense(groupId: string, expenseId: string): Promise<boolean> {
  try {
    await fetchWithAuth<true>(`${groupId}/expenses/${expenseId}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('[API] deleteExpense failed:', err)
    return false
  }
}

// ── Members ──

/**
 * Fetches all members of a split expense group.
 * @param groupId - Group ID
 * @returns Array of members with user info and balances
 */
export async function fetchMembers(groupId: string): Promise<Member[]> {
  return fetchWithAuth<Member[]>(`${groupId}/members`)
}

/**
 * Adds a user to a split expense group.
 * @param groupId - Group ID
 * @param userId - User ID to add
 * @returns The new member record, or null on error
 */
export async function addMember(groupId: string, userId: string): Promise<Member | null> {
  try {
    return await fetchWithAuth<Member>(`${groupId}/members`, {
      method: 'POST',
      body: { user_id: userId },
    })
  } catch (err) {
    console.error('[API] addMember failed:', err)
    return null
  }
}

/**
 * Toggles a member's active status in a group.
 * @param groupId - Group ID
 * @param memberId - Member ID
 * @param active - New active state
 * @returns The updated member record, or null on error
 */
export async function toggleMember(
  groupId: string,
  memberId: string,
  active: boolean,
): Promise<Member | null> {
  try {
    return await fetchWithAuth<Member>(`${groupId}/members/${memberId}`, {
      method: 'PUT',
      body: { active },
    })
  } catch (err) {
    console.error('[API] toggleMember failed:', err)
    return null
  }
}

/**
 * Removes a member from a split expense group.
 * @param groupId - Group ID
 * @param memberId - Member ID
 * @returns True if removed successfully, false on error
 */
export async function removeMember(groupId: string, memberId: string): Promise<boolean> {
  try {
    await fetchWithAuth<true>(`${groupId}/members/${memberId}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('[API] removeMember failed:', err)
    return false
  }
}

// ── Tags ──

/**
 * Fetches all tags for a group.
 * @param groupId - Group ID
 * @returns Array of tags with name and color
 */
export async function fetchTags(groupId: string): Promise<Tag[]> {
  return fetchWithAuth<Tag[]>(`${groupId}/tags`)
}

/**
 * Creates a new expense tag.
 * @param groupId - Group ID
 * @param data - Tag name and color
 * @returns The created tag, or null on error
 */
export async function createTag(
  groupId: string,
  data: { name: string; color: string },
): Promise<Tag | null> {
  try {
    return await fetchWithAuth<Tag>(`${groupId}/tags`, { method: 'POST', body: data })
  } catch (err) {
    console.error('[API] createTag failed:', err)
    return null
  }
}

/**
 * Updates a tag's name or color.
 * @param groupId - Group ID
 * @param tagId - Tag ID
 * @param data - Fields to update (name, color)
 * @returns The updated tag, or null on error
 */
export async function updateTag(
  groupId: string,
  tagId: string,
  data: { name?: string; color?: string },
): Promise<Tag | null> {
  try {
    return await fetchWithAuth<Tag>(`${groupId}/tags/${tagId}`, { method: 'PUT', body: data })
  } catch (err) {
    console.error('[API] updateTag failed:', err)
    return null
  }
}

/**
 * Deletes a tag from a group.
 * @param groupId - Group ID
 * @param tagId - Tag ID
 * @returns True if deleted successfully, false on error
 */
export async function deleteTag(groupId: string, tagId: string): Promise<boolean> {
  try {
    await fetchWithAuth<true>(`${groupId}/tags/${tagId}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('[API] deleteTag failed:', err)
    return false
  }
}

// ── Balances & Settlements ──

/**
 * Fetches current balances for all members in a group.
 * Shows who owes whom and net balances.
 * @param groupId - Group ID
 * @returns Balances with per-member and pairwise data
 */
export async function fetchBalances(groupId: string): Promise<BalancesResponse> {
  return fetchWithAuth<BalancesResponse>(`${groupId}/balances`)
}

/**
 * Fetches transfer/payment history for a group.
 * @param groupId - Group ID
 * @param params - Pagination and date range filters
 * @returns Paginated list of transfers
 */
export async function fetchTransfers(
  groupId: string,
  params?: { page?: number; limit?: number; date_from?: string; date_to?: string },
): Promise<PaginatedResponse<Transfer>> {
  return fetchWithAuth<PaginatedResponse<Transfer>>(`${groupId}/transfers`, {
    params: {
      page: params?.page?.toString(),
      limit: params?.limit?.toString(),
      date_start: params?.date_from,
      date_end: params?.date_to,
    },
  })
}

/**
 * Triggers the settle-up algorithm to calculate optimal debt settlements.
 * Minimizes the number of transfers needed to zero out balances.
 * @param groupId - Group ID
 * @returns Settlement plan with suggested transfers, or null on error
 */
export async function settleUp(groupId: string): Promise<SettleUpResponse | null> {
  try {
    return await fetchWithAuth<SettleUpResponse>(`${groupId}/settlements`, { method: 'POST', body: {} })
  } catch (err) {
    console.error('[API] settleUp failed:', err)
    return null
  }
}

/**
 * Records a direct payment (transfer) between two group members.
 * @param groupId - Group ID
 * @param data - Payment details: from_user, to_user, amount, and optional note
 * @returns True if recorded successfully, false on error
 */
export async function recordPayment(
  groupId: string,
  data: { from_user: string; to_user: string; amount: number; note?: string },
): Promise<boolean> {
  try {
    await fetchWithAuth(`${groupId}/payments`, { method: 'POST', body: data })
    return true
  } catch (err) {
    console.error('[API] recordPayment failed:', err)
    return false
  }
}

// ── Stats ──

/**
 * Fetches statistics for a group with optional date range and tag filter.
 * @param groupId - Group ID
 * @param params - Period, tag, and date range filters
 * @returns Statistics including total spent, per-person breakdown, and category distribution
 */
export async function fetchStats(
  groupId: string,
  params?: {
    period?: 'day' | 'week' | 'month' | 'year'
    tag_id?: string
    date_from?: string
    date_to?: string
  },
): Promise<StatsResponse> {
  return fetchWithAuth<StatsResponse>(`${groupId}/stats`, {
    params: {
      period: params?.period,
      tag_id: params?.tag_id,
      date_start: params?.date_from,
      date_end: params?.date_to,
    },
  })
}

// ── Transfers (manual CRUD) ──

/**
 * Creates a manual transfer (payment) between two members.
 * @param groupId - Group ID
 * @param data - Transfer details: from_user, to_user, amount, and optional note
 * @returns The created transfer, or null on error
 */
export async function createTransfer(
  groupId: string,
  data: CreateTransferInput,
): Promise<Transfer | null> {
  // Backend uses payments endpoint for manual transfers
  try {
    const res = await fetchWithAuth<{ payment: Transfer }>(`${groupId}/payments`, {
      method: 'POST',
      body: data,
    })
    return res.payment
  } catch (err) {
    console.error('[API] createTransfer failed:', err)
    return null
  }
}

/**
 * Updates an existing transfer.
 * @param groupId - Group ID
 * @param transferId - Transfer ID
 * @param data - Fields to update (amount, note, etc.)
 * @returns The updated transfer, or null on error
 */
export async function updateTransfer(
  groupId: string,
  transferId: string,
  data: UpdateTransferInput,
): Promise<Transfer | null> {
  try {
    return await fetchWithAuth<Transfer>(`${groupId}/transfers/${transferId}`, {
      method: 'PUT',
      body: data,
    })
  } catch (err) {
    console.error('[API] updateTransfer failed:', err)
    return null
  }
}

/**
 * Deletes a transfer.
 * @param groupId - Group ID
 * @param transferId - Transfer ID
 * @returns True if deleted successfully, false on error
 */
export async function deleteTransfer(groupId: string, transferId: string): Promise<boolean> {
  try {
    await fetchWithAuth<true>(`${groupId}/transfers/${transferId}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('[API] deleteTransfer failed:', err)
    return false
  }
}

// ── Pagination helper ──

/** Returns default pagination state (page 1, limit 20, empty). */
export function defaultPagination(): Pagination {
  return { page: 1, limit: 20, total: 0, total_pages: 0 }
}
