'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function resetPasswordAction(locale: string, _prevState: { success: boolean }, formData: FormData) {
  const email = (formData.get('email') as string)?.trim() ?? ''
  if (!email) return { success: true }

  const reqHeaders = await headers()
  const ip = reqHeaders.get('x-forwarded-for') ?? 'unknown'
  const rateCheck = checkRateLimit(`recover:${ip}`, 3, 60_000)
  if (!rateCheck.allowed) return { success: true }

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/${locale}/update-password`,
  })

  return { success: true }
}
