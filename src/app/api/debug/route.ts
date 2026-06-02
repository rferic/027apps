import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  const results: Record<string, unknown> = {
    env: { urlSet: !!url, keySet: !!key, smtpHost: !!process.env.SMTP_HOST, smtpUser: !!process.env.SMTP_USER, smtpPass: !!process.env.SMTP_PASS },
  }

  // Test email
  const emailResult = await sendEmail({
    to: '027apps@gmail.com',
    subject: '027Apps debug test',
    html: '<p>If you see this, email works!</p>',
  })
  results.emailTest = emailResult

  try {
    const supabase = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, count, error } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
    results.query = { data, count, error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null }
  } catch (err) {
    results.catchError = err instanceof Error ? err.message : String(err)
  }

  try {
    const supabase2 = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } })

    const grantSql = [
      'grant select, insert, update, delete on inspiration_requests to service_role;',
      'grant select, insert, update, delete on inspiration_votes to service_role;',
      'grant select, insert, update, delete on inspiration_comments to service_role;',
      'grant select, insert, update, delete on todo_items to service_role;',
    ].join('\n')
    const { error: grantError } = await supabase2.rpc('exec_sql', { sql: grantSql })
    results.grant = grantError ? { error: { message: grantError.message, code: grantError.code } } : { ok: true }
  } catch (err) {
    results.grantError = err instanceof Error ? err.message : String(err)
  }

  return Response.json(results)
}
