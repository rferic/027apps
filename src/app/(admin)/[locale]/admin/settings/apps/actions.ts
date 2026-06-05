'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/helpers'

export async function updateAppOrderAction(
  orderedSlugs: string[]
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAdmin()
    const adminClient = createAdminClientUntyped()

    // Update display_order for each app in the new order
    for (let i = 0; i < orderedSlugs.length; i++) {
      const { error } = await adminClient
        .from('installed_apps')
        .update({ display_order: i, updated_at: new Date().toISOString() })
        .eq('slug', orderedSlugs[i])
      if (error) {
        return { error: error.message }
      }
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
