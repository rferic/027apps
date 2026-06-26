import type { NextRequest } from 'next/server'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

async function requireAdmin(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)
  return auth
}

export async function GET(req: NextRequest) {
  const adminCheck = await requireAdmin(req)
  if (adminCheck instanceof Response) return adminCheck

  const url = new URL(req.url)
  const expenseGroupId = url.searchParams.get('id')
  const withDetails = url.searchParams.get('with_details')
  const db = createAdminClientUntyped()

  // Get single group with details
  if (expenseGroupId) {
    const { data: group } = await db.from('split_expenses_groups').select('*').eq('id', expenseGroupId).single()
    if (!group) return apiError('NOT_FOUND', 'Group not found', 404)

    if (withDetails) {
      const [{ data: members }, { data: expenses }, { data: transfers }, { data: parentGroup }] = await Promise.all([
        db.from('split_expenses_members').select('id, user_id, active').eq('expense_group_id', expenseGroupId),
        db.from('split_expenses_expenses').select('*').eq('expense_group_id', expenseGroupId).order('created_at', { ascending: false }).limit(50),
        db.from('split_expenses_transfers').select('*').eq('expense_group_id', expenseGroupId).order('created_at', { ascending: false }).limit(50),
        db.from('groups').select('name, slug').eq('id', group.group_id).single(),
      ])

      const userIds = new Set<string>()
      ;(members ?? []).forEach((m: any) => userIds.add(m.user_id))
      ;(expenses ?? []).forEach((e: any) => { userIds.add(e.paid_by); userIds.add(e.created_by) })
      ;(transfers ?? []).forEach((t: any) => { userIds.add(t.from_user); userIds.add(t.to_user) })

      const { data: profiles } = await db.from('profiles').select('id, display_name').in('id', [...userIds])
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]))

      return apiOk({
        ...group,
        parentGroup: parentGroup ?? null,
        members: (members ?? []).map((m: any) => ({ ...m, display_name: profileMap.get(m.user_id) ?? null })),
        expenses: (expenses ?? []).map((e: any) => ({ ...e, paid_by_name: profileMap.get(e.paid_by) ?? null })),
        transfers: (transfers ?? []).map((t: any) => ({ ...t, from_name: profileMap.get(t.from_user) ?? null, to_name: profileMap.get(t.to_user) ?? null })),
      })
    }

    return apiOk(group)
  }

  // List all groups with optional details
  const { data: groups } = await db.from('split_expenses_groups').select('id, title, emoji, currency, group_id, created_at').order('created_at', { ascending: false })

  if (withDetails) {
    const details = await Promise.all((groups ?? []).map(async (g: any) => {
      const [{ count: members }, { data: expenses }, { data: parentGroup }] = await Promise.all([
        db.from('split_expenses_members').select('*', { count: 'exact', head: true }).eq('expense_group_id', g.id).eq('active', true),
        db.from('split_expenses_expenses').select('amount').eq('expense_group_id', g.id),
        db.from('groups').select('name, slug').eq('id', g.group_id).single(),
      ])
      return { ...g, members: members ?? 0, totalExpenses: Math.round((expenses ?? []).reduce((s: number, e: any) => s + parseFloat(e.amount), 0) * 100) / 100, parentGroup: parentGroup ?? null }
    }))
    return apiOk({ groups: details })
  }

  return apiOk(groups ?? [])
}

export async function PUT(req: NextRequest) {
  const adminCheck = await requireAdmin(req)
  if (adminCheck instanceof Response) return adminCheck

  const body = await req.json().catch(() => ({}))
  const id = new URL(req.url).searchParams.get('id')
  const action = new URL(req.url).searchParams.get('action')
  const db = createAdminClientUntyped()

  if (!id) return apiError('BAD_REQUEST', 'Missing id', 400)

  // Edit group
  if (!action) {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title) update.title = body.title
    if (body.emoji) update.emoji = body.emoji
    if (body.currency) update.currency = body.currency
    const { data, error } = await db.from('split_expenses_groups').update(update).eq('id', id).select().single()
    if (error) return apiError('UPDATE_FAILED', error.message, 500)
    return apiOk(data)
  }

  // Edit member (toggle active)
  if (action === 'member') {
    const memberId = body.member_id
    const active = body.active
    if (!memberId) return apiError('BAD_REQUEST', 'Missing member_id', 400)
    const { error } = await db.from('split_expenses_members').update({ active }).eq('id', memberId).eq('expense_group_id', id)
    if (error) return apiError('UPDATE_FAILED', error.message, 500)
    return apiOk({ success: true })
  }

  return apiError('BAD_REQUEST', 'Invalid action', 400)
}

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req)
  if (adminCheck instanceof Response) return adminCheck

  const body = await req.json().catch(() => ({}))
  const id = new URL(req.url).searchParams.get('id')
  const action = new URL(req.url).searchParams.get('action')
  const db = createAdminClientUntyped()

  if (!id) return apiError('BAD_REQUEST', 'Missing id', 400)

  // Add member
  if (action === 'add_member') {
    const userId = body.user_id
    if (!userId) return apiError('BAD_REQUEST', 'Missing user_id', 400)

    // Check if already a member
    const { data: existing } = await db.from('split_expenses_members').select('id').eq('expense_group_id', id).eq('user_id', userId).maybeSingle()
    if (existing) {
      // Reactivate
      const { data, error } = await db.from('split_expenses_members').update({ active: true }).eq('id', existing.id).select().single()
      if (error) return apiError('UPDATE_FAILED', error.message, 500)
      return apiOk(data)
    }

    const { data, error } = await db.from('split_expenses_members').insert({ expense_group_id: id, user_id: userId, active: true }).select().single()
    if (error) return apiError('CREATE_FAILED', error.message, 500)
    return apiOk(data, 201)
  }

  // Delete expense
  if (action === 'delete_expense') {
    const expenseId = body.expense_id
    if (!expenseId) return apiError('BAD_REQUEST', 'Missing expense_id', 400)
    const { error } = await db.from('split_expenses_expenses').delete().eq('id', expenseId).eq('expense_group_id', id)
    if (error) return apiError('DELETE_FAILED', error.message, 500)
    return new Response(null, { status: 204 })
  }

  // Delete transfer
  if (action === 'delete_transfer') {
    const transferId = body.transfer_id
    if (!transferId) return apiError('BAD_REQUEST', 'Missing transfer_id', 400)
    const { error } = await db.from('split_expenses_transfers').delete().eq('id', transferId).eq('expense_group_id', id)
    if (error) return apiError('DELETE_FAILED', error.message, 500)
    return new Response(null, { status: 204 })
  }

  return apiError('BAD_REQUEST', 'Invalid action', 400)
}

export async function DELETE(req: NextRequest) {
  const adminCheck = await requireAdmin(req)
  if (adminCheck instanceof Response) return adminCheck

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return apiError('BAD_REQUEST', 'Missing id', 400)

  const db = createAdminClientUntyped()

  const { data: existing } = await db.from('split_expenses_groups').select('id').eq('id', id).single()
  if (!existing) return apiError('NOT_FOUND', 'Expense group not found', 404)

  const { error } = await db.from('split_expenses_groups').delete().eq('id', id)
  if (error) return apiError('DELETE_FAILED', error.message, 500)

  return new Response(null, { status: 204 })
}
