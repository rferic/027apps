'use server'

import { createClient } from '@/lib/supabase/server'

export async function resetPasswordAction(locale: string, _prevState: { success: boolean }, formData: FormData) {
  const email = (formData.get('email') as string).trim()
  if (!email) return { success: true }

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/${locale}/update-password`,
  })

  return { success: true }
}
