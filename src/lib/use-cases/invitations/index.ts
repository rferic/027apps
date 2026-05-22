import { createAdminClient } from '@/lib/supabase/admin'

export type Invitation = {
  id: string
  token: string
  title: string
  role: 'admin' | 'member'
  email: string | null
  invitedBy: string
  acceptedBy: string | null
  acceptedAt: string | null
  revokedAt: string | null
  expiresAt: string | null
  createdAt: string
  groupIds: string[]
  locale: string
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export function getInvitationStatus(inv: Invitation): InvitationStatus {
  if (inv.revokedAt) return 'revoked'
  if (inv.acceptedAt) return 'accepted'
  if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) return 'expired'
  return 'pending'
}

export async function getAdminInvitationList(): Promise<Invitation[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('invitations')
    .select('*')
    .order('created_at', { ascending: false })

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    token: row.token as string,
    title: row.title as string,
    role: row.role as 'admin' | 'member',
    email: (row.email as string) ?? null,
    invitedBy: row.invited_by as string,
    acceptedBy: (row.accepted_by as string) ?? null,
    acceptedAt: (row.accepted_at as string) ?? null,
    revokedAt: (row.revoked_at as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
    createdAt: row.created_at as string,
    groupIds: (row.group_ids as string[]) ?? [],
    locale: (row.locale as string) ?? 'es',
  }))
}

export async function createInvitation(data: {
  title: string
  role: 'admin' | 'member'
  email: string | null
  expiresAt: string | null
  invitedBy: string
  groupIds: string[]
  locale: string
}): Promise<{ token: string } | { error: string }> {
  const supabase = createAdminClient()
  const { data: row, error } = await supabase
    .from('invitations')
    .insert({
      title: data.title,
      role: data.role,
      email: data.email || null,
      expires_at: data.expiresAt || null,
      invited_by: data.invitedBy,
      group_ids: data.groupIds,
      locale: data.locale,
    })
    .select('token')
    .single()

  if (error || !row) return { error: error?.message ?? 'Failed to create invitation' }
  return { token: row.token }
}

export async function revokeInvitation(id: string): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('accepted_at', null)
    .is('revoked_at', null)
  return { error: error?.message ?? null }
}

export async function deleteInvitation(id: string): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .single()

  if (!data) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any
  return {
    id: row.id,
    token: row.token,
    title: row.title,
    role: row.role as 'admin' | 'member',
    email: row.email ?? null,
    invitedBy: row.invited_by,
    acceptedBy: row.accepted_by ?? null,
    acceptedAt: row.accepted_at ?? null,
    revokedAt: row.revoked_at ?? null,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
    groupIds: row.group_ids ?? [],
    locale: row.locale ?? 'es',
  }
}

export async function acceptInvitation(
  token: string,
  data: { email: string; displayName: string; password: string }
): Promise<{ error: string } | { success: true }> {
  const supabase = createAdminClient()

  const invitation = await getInvitationByToken(token)
  if (!invitation) return { error: 'Invalid invitation' }

  const status = getInvitationStatus(invitation)
  if (status !== 'pending') return { error: `Invitation is ${status}` }
  if (invitation.email && invitation.email.toLowerCase() !== data.email.toLowerCase()) {
    return { error: 'Email does not match invitation' }
  }

  const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { display_name: data.displayName, locale: invitation.locale },
  })
  if (createError || !authUser.user) return { error: createError?.message ?? 'Failed to create user' }

  const userId = authUser.user.id

  // Upsert en lugar de insert: el trigger on_auth_user_created puede haber creado
  // el perfil antes de que lleguemos aquí. El upsert garantiza el nombre correcto.
  await supabase.from('profiles').upsert({ id: userId, display_name: data.displayName, locale: invitation.locale })

  const groupIds = invitation.groupIds && invitation.groupIds.length > 0
    ? [...invitation.groupIds]
    : [] as string[]

  if (groupIds.length === 0) {
    // Fallback for legacy invitations without group_ids: use first group found
    const { data: group } = await supabase
      .from('groups')
      .select('id')
      .limit(1)
      .single()
    if (group) groupIds.push(group.id)
  }

  for (const gid of groupIds) {
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: gid,
        user_id: userId,
        role: invitation.role,
        invited_by: invitation.invitedBy,
      })
    // If already exists (unique constraint), ignore the error
    if (memberError && !memberError.message.includes('duplicate')) {
      console.error('Failed to add user to group:', memberError.message)
    }
  }

  await supabase
    .from('invitations')
    .update({ accepted_by: userId, accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  return { success: true }
}
