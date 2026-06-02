import { type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api/response'
import { authenticate } from '@/lib/api/auth'
import { resolveGroupContext } from '@/lib/groups/context'
import { getAppRouteHandler } from '@/lib/apps/route-registry'
import type { HandlerContext } from '@/lib/apps/router-types'

const SLUG_RE = /^[a-z0-9-]+$/

async function dispatch(req: NextRequest, slug: string, segments: string[], groupSlug: string): Promise<Response> {
  if (!SLUG_RE.test(slug)) return apiError('INVALID_SLUG', 'Invalid app slug', 400)

  // 1. Try cookie-based auth (SSR session in Route Handler)
  const cookieStore = await cookies()
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: async () => {},
      },
    }
  )
  let userId: string | undefined
  const { data: { user } } = await ssr.auth.getUser()
  if (user) userId = user.id

  // 2. Fallback to Authorization header (for fetchWithAuth clients)
  if (!userId && req.headers.get('Authorization')?.startsWith('Bearer ')) {
    const auth = await authenticate(req, 'jwt')
    if (!(auth instanceof Response)) userId = auth.userId
  }

  if (!userId) return apiError('UNAUTHORIZED', 'Authentication required', 401)

  const groupCtx = await resolveGroupContext(groupSlug, userId)
  if (!groupCtx) return apiError('NOT_FOUND', 'Group not found', 404)

  const adminClient = createAdminClient()
  const { data: app } = await adminClient
    .from('installed_apps')
    .select('status')
    .eq('slug', slug)
    .single()

  if (!app || app.status !== 'active') {
    return apiError('NOT_FOUND', 'App not found or not active', 404)
  }

  const method = req.method.toUpperCase()
  const handler = getAppRouteHandler(slug, method, segments)

  if (!handler) {
    return apiError('NOT_FOUND', 'Route not found', 404)
  }

  const ctx: HandlerContext = { groupId: groupCtx.id, groupSlug, userId }
  return handler(req, ctx)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ 'group-slug': string; slug: string; path?: string[] }> }) {
  const { 'group-slug': groupSlug, slug, path: segments = [] } = await params
  return dispatch(req, slug, segments, groupSlug)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ 'group-slug': string; slug: string; path?: string[] }> }) {
  const { 'group-slug': groupSlug, slug, path: segments = [] } = await params
  return dispatch(req, slug, segments, groupSlug)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ 'group-slug': string; slug: string; path?: string[] }> }) {
  const { 'group-slug': groupSlug, slug, path: segments = [] } = await params
  return dispatch(req, slug, segments, groupSlug)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ 'group-slug': string; slug: string; path?: string[] }> }) {
  const { 'group-slug': groupSlug, slug, path: segments = [] } = await params
  return dispatch(req, slug, segments, groupSlug)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ 'group-slug': string; slug: string; path?: string[] }> }) {
  const { 'group-slug': groupSlug, slug, path: segments = [] } = await params
  return dispatch(req, slug, segments, groupSlug)
}
