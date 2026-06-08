import type { AppInstallContext } from '@/types/apps'

const DEFAULT_CATEGORIES: [string, string, string, number][] = [
  ['Tarea', '📌', '#6B7280', 0],
  ['Recordatorio', '⏰', '#F59E0B', 1],
  ['Compras', '🛒', '#10B981', 2],
  ['Limpieza', '🧹', '#6366F1', 3],
  ['Pendientes', '📋', '#8B5CF6', 4],
  ['Llamar', '📞', '#3B82F6', 5],
  ['Objetivo', '🎯', '#EF4444', 6],
  ['Cumpleaños', '🎂', '#EC4899', 7],
]

export async function install(ctx: AppInstallContext): Promise<void> {
  const values = DEFAULT_CATEGORIES.map(
    ([name, emoji, color, order]) =>
      `(${quote(name)}, ${quote(emoji)}, ${quote(color)}, ${order})`
  ).join(',\n')

  // Try direct insert first
  const { error: directError } = await ctx.supabase.from('todo_categories').insert(
    DEFAULT_CATEGORIES.map(([name, emoji, color, order]) => ({
      name, emoji, color, display_order: order,
    }))
  )

  if (!directError) return

  // If direct insert failed (PostgREST schema cache), try exec_sql
  const { error: sqlError } = await ctx.supabase.rpc('exec_sql' as any, {
    sql: `insert into todo_categories (name, emoji, color, display_order) values ${values};`,
  })

  if (sqlError) throw new Error(`Failed to insert categories: ${(sqlError as { message: string }).message}`)
}

function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}
