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
      `(${quote(name)}::text, ${quote(emoji)}::text, ${quote(color)}::text, ${order})`
  ).join(',\n')

  // Use raw SQL to bypass PostgREST schema cache (table was just created by migration)
  const { error } = await ctx.supabase.rpc('exec_sql' as any, {
    sql: `insert into todo_categories (name, emoji, color, display_order) values ${values} on conflict do nothing;`,
  })

  if (error) throw new Error(`Failed to insert categories: ${(error as { message: string }).message}`)
}

function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}
