import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Direct SMTP test (no sendEmail wrapper)
  let smtpTest: Record<string, unknown> = { attempted: false }
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (host && port && user && pass) {
    try {
      const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
      await transporter.sendMail({
        from: `"027Apps" <${process.env.SMTP_FROM ?? user}>`,
        to: '027apps@gmail.com',
        subject: '027Apps debug test',
        html: '<p>If you see this, email works!</p>',
      })
      smtpTest = { attempted: true, ok: true }
    } catch (err) {
      smtpTest = { attempted: true, ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  } else {
    smtpTest = { attempted: false, reason: 'missing vars', host: !!host, port: !!port, user: !!user, pass: !!pass }
  }

  const results: Record<string, unknown> = {
    env: { urlSet: !!url, keySet: !!key, smtpHost: !!host, smtpUser: !!user, smtpPass: !!pass, smtpPort: port },
    smtpTest,

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
