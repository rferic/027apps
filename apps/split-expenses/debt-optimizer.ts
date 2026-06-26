export interface Share {
  user_id: string
  amount: number
}

export interface Expense {
  id: string
  paid_by: string
  amount?: number
  shares: Share[]
}

export interface Transfer {
  from_user: string
  to_user: string
  amount: number
}

export interface Balance {
  user_id: string
  net_balance: number
}

export function calculateBalances(expenses: Expense[]): Balance[] {
  const net: Record<string, number> = {}

  for (const expense of expenses) {
    const total = expense.amount ?? expense.shares.reduce((sum, s) => sum + s.amount, 0)
    net[expense.paid_by] = (net[expense.paid_by] ?? 0) + total

    for (const share of expense.shares) {
      net[share.user_id] = (net[share.user_id] ?? 0) - share.amount
    }
  }

  return Object.entries(net)
    .filter(([_, amount]) => Math.abs(amount) > 0.01)
    .map(([user_id, net_balance]) => ({ user_id, net_balance: Math.round(net_balance * 100) / 100 }))
}

export function optimizeTransfers(balances: Balance[]): Transfer[] {
  const creditors = balances.filter(b => b.net_balance > 0).sort((a, b) => b.net_balance - a.net_balance)
  const debtors = balances.filter(b => b.net_balance < 0).sort((a, b) => a.net_balance - b.net_balance)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = Math.min(-debtor.net_balance, creditor.net_balance)

    transfers.push({
      from_user: debtor.user_id,
      to_user: creditor.user_id,
      amount: Math.round(amount * 100) / 100,
    })

    debtor.net_balance += amount
    creditor.net_balance -= amount

    if (Math.abs(debtor.net_balance) < 0.01) i++
    if (Math.abs(creditor.net_balance) < 0.01) j++
  }

  return transfers
}
