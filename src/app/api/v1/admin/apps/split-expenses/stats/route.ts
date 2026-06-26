import type { NextRequest } from 'next/server'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const db = createAdminClientUntyped()

  const [
    { count: totalGroups },
    { count: totalExpenses },
    { data: groups },
    { count: totalMembers },
    { count: totalTransfers },
  ] = await Promise.all([
    db.from('split_expenses_groups').select('*', { count: 'exact', head: true }),
    db.from('split_expenses_expenses').select('*', { count: 'exact', head: true }),
    db.from('split_expenses_groups').select('id, title, emoji, currency, group_id'),
    db.from('split_expenses_members').select('*', { count: 'exact', head: true }),
    db.from('split_expenses_transfers').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
  ])

  // Get member count per group
  const groupDetails = await Promise.all((groups ?? []).map(async (g: any) => {
    const { count: members } = await db.from('split_expenses_members')
      .select('*', { count: 'exact', head: true }).eq('expense_group_id', g.id).eq('active', true)
    const { data: expenses } = await db.from('split_expenses_expenses')
      .select('amount').eq('expense_group_id', g.id)
    const total = (expenses ?? []).reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0)
    // Get parent group name
    const { data: parentGroup } = await db.from('groups').select('name, slug').eq('id', g.group_id).single()
    return {
      id: g.id,
      title: g.title,
      emoji: g.emoji,
      currency: g.currency,
      members: members ?? 0,
      totalExpenses: Math.round(total * 100) / 100,
      parentGroup: parentGroup ? { name: parentGroup.name, slug: parentGroup.slug } : null,
    }
  }))

  return apiOk({
    totalGroups: totalGroups ?? 0,
    totalExpenses: totalExpenses ?? 0,
    totalMembers: totalMembers ?? 0,
    totalTransfers: totalTransfers ?? 0,
    groups: groupDetails,
  })
}
