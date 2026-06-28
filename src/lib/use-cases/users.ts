import { createAdminClient } from '@/lib/supabase/admin'

export async function createUser(
  email: string,
  password: string,
  displayName: string,
): Promise<{ user: { id: string } | null; error: string | null }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  })

  if (error) return { user: null, error: error.message }

  await supabase
    .from('profiles')
    .upsert({ id: data.user!.id, display_name: displayName })
    .throwOnError()

  return { user: { id: data.user!.id }, error: null }
}

export async function deleteUser(userId: string): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  return { error: null }
}
