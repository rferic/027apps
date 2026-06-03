import { NextRequest, NextResponse } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { routing } from '@/i18n/routing'
import type { Database } from '@/types/supabase'

const intlMiddleware = createIntlMiddleware(routing)
const VALID_LOCALES = ['en', 'es', 'it', 'ca', 'fr', 'de']
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function preferredLocale(request: NextRequest): string {
  const raw = request.cookies.get('preferred-locale')?.value
  return raw && VALID_LOCALES.includes(raw) ? raw : 'en'
}

function clearAuthCookies(response: NextResponse, request: NextRequest): NextResponse {
  request.cookies.getAll().forEach(({ name }) => {
    if (name.startsWith('sb-')) response.cookies.delete(name)
  })
  return response
}

function localeFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/(es|en|it|ca|fr|de)(?:\/|$)/)
  return match?.[1] ?? null
}

async function refreshSession(
  request: NextRequest,
  baseResponse: NextResponse
): Promise<{ user: { id: string } | null; response: NextResponse }> {
  let response = baseResponse

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, maxAge: COOKIE_MAX_AGE })
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error) user = data.user
  } catch {
    // stale/invalid session — treat as unauthenticated
  }

  return { user, response }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const locale = preferredLocale(request)
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}${pathname}`
    return NextResponse.redirect(url)
  }

  // Redirect old /doc/{lang}/... and /doc/path/... to /{locale}/doc/...
  if (pathname === '/doc' || pathname.startsWith('/doc/') || pathname === '/docs' || pathname.startsWith('/docs/')) {
    const isDocs = pathname.startsWith('/docs')
    const base = isDocs ? '/docs' : '/doc'
    const after = pathname === base ? '' : pathname.slice(base.length)
    const first = after.split('/')[0]
    if (VALID_LOCALES.includes(first)) {
      return NextResponse.redirect(new URL(`/${first}/doc${after.slice(first.length)}`, request.url))
    }
    return NextResponse.redirect(new URL(`/${preferredLocale(request)}/doc${after ? `/${after}` : ''}`, request.url))
  }

  const intlResponse = intlMiddleware(request)
  const isAdminRoute = /^\/(es|en|it|ca|fr|de)\/admin(\/|$)/.test(pathname)

  if (isAdminRoute) {
    const { user, response } = await refreshSession(request, intlResponse)

    if (!user) {
      const locale = localeFromPathname(pathname) ?? preferredLocale(request)
      const loginResponse = NextResponse.redirect(new URL(`/${locale}/login`, request.url))
      clearAuthCookies(loginResponse, request)
      return loginResponse
    }

    response.headers.set('x-invoke-path', pathname)
    return response
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            intlResponse.cookies.set(name, value, { ...options, maxAge: COOKIE_MAX_AGE })
          )
        },
      },
    }
  )
  await supabase.auth.getUser()

  // Pasar el pathname al Server Component via response header
  // Next.js reenvía response headers del middleware a headers() en SC
  intlResponse.headers.set('x-invoke-path', pathname)
  return intlResponse
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/doc',
    '/doc/:path*',
    '/(es|en|it|ca|fr|de)/:path*',
    '/((?!_next|api|doc|install|invite|favicon\.ico|.*\..*).*)',
  ],
}
