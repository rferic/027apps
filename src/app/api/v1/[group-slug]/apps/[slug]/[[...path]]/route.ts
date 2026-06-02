import { type NextRequest } from 'next/server'
import { createAdminClient, createAdminClientUntyped } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api/response'
import { authenticate } from '@/lib/api/auth'
import { resolveGroupContext } from '@/lib/groups/context'
import { getAppRouteHandler } from '@/lib/apps/route-registry'
import type { HandlerContext } from '@/lib/apps/router-types'

const SLUG_RE = /^[a-z0-9-]+$/

async function dispatch(req: NextRequest, slug: string, segments: string[], groupSlug: string): Promise<Response> {
  if (!SLUG_RE.test(slug)) return apiError('INVALID_SLUG', 'Invalid app slug', 400)

  // Try authenticate — if it fails, we still try to resolve group from slug
  const auth = await authenticate(req, 'jwt')
  let groupId: string | null = null

  if (!(auth instanceof Response) && auth.userId) {
    const groupCtx = await resolveGroupContext(groupSlug, auth.userId)
    if (groupCtx) groupId = groupCtx.id
  }

  // Fallback: resolve group from slug without user membership check
  if (!groupId) {
    const adminClient = createAdminClientUntyped()
    const { data: group } = await adminClient
      .from('groups')
      .select('id')
      .eq('slug', groupSlug)
      .maybeSingle()
    if (group) groupId = (group as Record<string, unknown>).id as string
  }

  if (!groupId) return apiError('NOT_FOUND', 'Group not found', 404)

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

  const ctx: HandlerContext = { groupId, groupSlug }
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
