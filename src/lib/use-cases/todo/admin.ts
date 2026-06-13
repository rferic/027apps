import { createAdminClientUntyped } from '@/lib/supabase/admin'

export interface TodoAdminStats {
  total: number
  pending: number
  done: number
}

export async function getTodoAdminStats(): Promise<TodoAdminStats> {
  const db = createAdminClientUntyped()

  const [{ count: total }, { count: pending }, { count: done }] = await Promise.all([
    db.from('todo_items').select('*', { count: 'exact', head: true }),
    db.from('todo_items').select('*', { count: 'exact', head: true }).not('status', 'in', '("done","cancelled")'),
    db.from('todo_items').select('*', { count: 'exact', head: true }).eq('status', 'done'),
  ])

  return {
    total: total ?? 0,
    pending: pending ?? 0,
    done: done ?? 0,
  }
}
