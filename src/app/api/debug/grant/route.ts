import { NextResponse } from 'next/server'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

export async function GET() {
  const admin = createAdminClientUntyped()
  
  // Grant permissions on all app tables
  const grants = [
    'grant select, insert, update, delete on inspiration_requests to service_role;',
    'grant select, insert, update, delete on inspiration_votes to service_role;',
    'grant select, insert, update, delete on inspiration_comments to service_role;',
    'grant select, insert, update, delete on todo_items to service_role;',
  ]

  const results: { sql: string; ok: boolean; error?: string }[] = []
  
  for (const sql of grants) {
    const { error } = await admin.rpc('exec_sql', { sql })
    results.push({ sql, ok: !error, error: error?.message })
  }

  return NextResponse.json(results)
}
