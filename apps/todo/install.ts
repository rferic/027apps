import type { AppInstallContext } from '@/types/apps'

interface CatDef { name: string; emoji: string; color: string; display_order: number; is_default: boolean }

const DEFAULT_CATEGORIES: CatDef[] = [
  { name: 'Tarea', emoji: '📌', color: '#6B7280', display_order: 0, is_default: true },
  { name: 'Recordatorio', emoji: '⏰', color: '#F59E0B', display_order: 1, is_default: false },
  { name: 'Compras', emoji: '🛒', color: '#10B981', display_order: 2, is_default: false },
  { name: 'Limpieza', emoji: '🧹', color: '#6366F1', display_order: 3, is_default: false },
  { name: 'Pendientes', emoji: '📋', color: '#8B5CF6', display_order: 4, is_default: false },
  { name: 'Llamar', emoji: '📞', color: '#3B82F6', display_order: 5, is_default: false },
  { name: 'Objetivo', emoji: '🎯', color: '#EF4444', display_order: 6, is_default: false },
  { name: 'Cumpleaños', emoji: '🎂', color: '#EC4899', display_order: 7, is_default: false },
]

export async function install(ctx: AppInstallContext): Promise<void> {
  // Try direct insert first
  const { error: directError } = await ctx.supabase.from('todo_categories').insert(DEFAULT_CATEGORIES)

  if (!directError) return

  // If direct insert failed (PostgREST schema cache), try exec_sql
  const values = DEFAULT_CATEGORIES.map(c =>
    `(${quote(c.name)}, ${quote(c.emoji)}, ${quote(c.color)}, ${c.display_order}, ${c.is_default})`
  ).join(',\n')

  const { error: sqlError } = await ctx.supabase.rpc('exec_sql' as any, {
    sql: `insert into todo_categories (name, emoji, color, display_order, is_default) values ${values};`,
  })

  if (sqlError) throw new Error(`Failed to insert categories: ${(sqlError as { message: string }).message}`)
}

function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}
