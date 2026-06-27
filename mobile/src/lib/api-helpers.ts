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

export async function fetchExpenseGroup(id: string): Promise<ExpenseGroupDetail> {
  return fetchWithAuth<ExpenseGroupDetail>(id)
}

export async function createExpenseGroup(data: CreateGroupInput): Promise<ExpenseGroup | null> {
  try {
    return await fetchWithAuth<ExpenseGroup>('', { method: 'POST', body: data })
  } catch (err) {
    console.error('[API] createExpenseGroup failed:', err)
    return null
  }
}

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

export async function fetchExpense(groupId: string, expenseId: string): Promise<Expense> {
  return fetchWithAuth<Expense>(`${groupId}/expenses/${expenseId}`)
}

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

export async function fetchMembers(groupId: string): Promise<Member[]> {
  return fetchWithAuth<Member[]>(`${groupId}/members`)
}

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

export async function fetchTags(groupId: string): Promise<Tag[]> {
  return fetchWithAuth<Tag[]>(`${groupId}/tags`)
}

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

export async function fetchBalances(groupId: string): Promise<BalancesResponse> {
  return fetchWithAuth<BalancesResponse>(`${groupId}/balances`)
}

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

export async function settleUp(groupId: string): Promise<SettleUpResponse | null> {
  try {
    return await fetchWithAuth<SettleUpResponse>(`${groupId}/settlements`, { method: 'POST', body: {} })
  } catch (err) {
    console.error('[API] settleUp failed:', err)
    return null
  }
}

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

export function defaultPagination(): Pagination {
  return { page: 1, limit: 20, total: 0, total_pages: 0 }
}
