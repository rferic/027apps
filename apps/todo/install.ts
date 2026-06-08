import type { AppInstallContext } from '@/types/apps'

const DEFAULT_CATEGORIES = [
  { name: 'Tarea', emoji: '📌', color: '#6B7280', display_order: 0 },
  { name: 'Recordatorio', emoji: '⏰', color: '#F59E0B', display_order: 1 },
  { name: 'Compras', emoji: '🛒', color: '#10B981', display_order: 2 },
  { name: 'Limpieza', emoji: '🧹', color: '#6366F1', display_order: 3 },
  { name: 'Pendientes', emoji: '📋', color: '#8B5CF6', display_order: 4 },
  { name: 'Llamar', emoji: '📞', color: '#3B82F6', display_order: 5 },
  { name: 'Objetivo', emoji: '🎯', color: '#EF4444', display_order: 6 },
  { name: 'Cumpleaños', emoji: '🎂', color: '#EC4899', display_order: 7 },
]

export async function install(ctx: AppInstallContext): Promise<void> {
  // Use separate exec_sql calls (multi-statement not guaranteed in PL/pgSQL)
  const { error: deleteError } = await ctx.supabase.rpc('exec_sql', {
    sql: 'delete from todo_categories',
  })
  if (deleteError) throw new Error(`Failed to clear categories: ${deleteError.message}`)

  const values = DEFAULT_CATEGORIES.map(c =>
    `('${c.name}', '${c.emoji}', '${c.color}', ${c.display_order})`
  ).join(',\n')

  const { error: insertError } = await ctx.supabase.rpc('exec_sql', {
    sql: `insert into todo_categories (name, emoji, color, display_order) values ${values};`,
  })
  if (insertError) throw new Error(`Failed to insert categories: ${insertError.message}`)
}
