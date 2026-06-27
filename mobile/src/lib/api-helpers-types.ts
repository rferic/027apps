// Split Expenses API types — based on actual API response shapes

export interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface Profile {
  display_name: string | null
  avatar_url: string | null
}

// ── Groups ──

export interface ExpenseGroup {
  id: string
  group_id: string
  title: string
  emoji: string
  currency: string
  created_by: string
  created_at: string
  updated_at: string
  member_count?: number
  my_balance?: number
  total_amount?: number
  my_paid?: number
  pending_amount?: number
}

export interface ExpenseGroupDetail extends ExpenseGroup {
  members: Member[]
}

// ── Expenses ──

export interface Expense {
  id: string
  expense_group_id: string
  title: string
  amount: number
  paid_by: string
  tag_id: string | null
  created_by: string
  created_at: string
  paid_by_profile: Profile | null
  shares: Share[]
}

export interface Share {
  id: string
  expense_id: string
  user_id: string
  amount: number
  user_profile: Profile | null
}

// ── Members ──

export interface Member {
  id: string
  expense_group_id: string
  user_id: string
  active: boolean
  created_at: string
  display_name: string | null
  avatar_url: string | null
}

// ── Tags ──

export interface Tag {
  id: string
  expense_group_id: string
  name: string
  color: string
  created_at?: string
}

// ── Balances ──

export interface Balance {
  user_id: string
  display_name: string | null
  net_balance: number
}

export interface SuggestedTransfer {
  from_user: string
  to_user: string
  amount: number
  from_name: string | null
  to_name: string | null
}

// ── Transfers (completed) ──

export interface Transfer {
  id: string
  from_user: string
  to_user: string
  amount: number
  status: 'pending' | 'completed' | 'cancelled'
  is_manual?: boolean
  note: string | null
  created_at: string
  from_name: string | null
  to_name: string | null
}

// ── Stats ──

export interface StatEntry {
  label: string
  total: number
}

// ── Input types ──

export interface CreateGroupInput {
  title: string
  emoji?: string
  currency?: string
  members?: string[]
}

export interface CreateExpenseInput {
  title: string
  amount: number
  paid_by: string
  tag_id?: string | null
  participant_ids: string[]
  created_at?: string
}

export interface UpdateExpenseInput {
  title?: string
  amount?: number
  paid_by?: string
  tag_id?: string | null
  participant_ids?: string[]
  created_at?: string
}

export interface CreateTransferInput {
  from_user: string
  to_user: string
  amount: number
  note?: string
  created_at?: string
}

export interface UpdateTransferInput {
  from_user?: string
  to_user?: string
  amount?: number
  note?: string | null
  created_at?: string
}

// ── API wrapper types ──

export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

export interface BalancesResponse {
  balances: Balance[]
  transfers: SuggestedTransfer[]
}

export interface StatsResponse {
  byPeriod: StatEntry[]
  cumulative: StatEntry[]
}

export interface SettleUpResponse {
  settlement: Record<string, unknown>
  transfers_created: number
  transfers: SuggestedTransfer[]
}
