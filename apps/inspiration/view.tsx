'use client'

import { useState, useEffect, useCallback, useRef, type ComponentType, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Lightbulb, Search, Bug, Sparkles, AppWindow, Puzzle, MoreHorizontal,
  Heart, MessageSquare, Plus, X, Loader2, ChevronDown, ChevronUp,
  CheckCircle2, Flame, Clock, User, SlidersHorizontal, ExternalLink,
} from 'lucide-react'
import { useAppContext } from '@/lib/apps/context'
import { createClient } from '@/lib/supabase/client'
import CreateRequestModal from './CreateRequestModal'

const supabase = createClient()

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {}
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers as Record<string, string>)) {
      headers[k] = v
    }
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  return fetch(url, { ...options, headers, credentials: 'include' })
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Creator {
  display_name: string | null
  avatar_url: string | null
}

interface RequestItem {
  id: string
  title: string
  description: string
  type: string
  status: string
  app_slug: string | null
  user_id: string
  created_at: string
  vote_count: number
  comment_count: number
  user_has_voted: boolean
  creator: Creator | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  total_pages: number
}

interface Comment {
  id: string
  request_id: string
  user_id: string
  body: string
  created_at: string
  user?: { display_name: string; avatar_url: string | null }
}

interface CommentPagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

interface AppInfo {
  slug: string
  name: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: ComponentType<{ size?: number; className?: string }>; color: string }> = {
  bug: { icon: Bug, color: '#EF4444' },
  improvement: { icon: Sparkles, color: '#F59E0B' },
  new_app: { icon: AppWindow, color: '#8B5CF6' },
  new_app_feature: { icon: Puzzle, color: '#3B82F6' },
  new_general_functionality: { icon: Lightbulb, color: '#10B981' },
  other: { icon: MoreHorizontal, color: '#6B7280' },
}

const STATUS_CONFIG: Record<string, { color: string }> = {
  pending: { color: '#F59E0B' },
  reviewing: { color: '#3B82F6' },
  approved: { color: '#10B981' },
  in_progress: { color: '#F97316' },
  completed: { color: '#7C3AED' },
  rejected: { color: '#EF4444' },
  on_hold: { color: '#6B7280' },
  duplicate: { color: '#8B5CF6' },
}

const ACTIVE_STATUSES = 'pending,reviewing,approved,in_progress,on_hold'

const TYPE_ALL = 'all'
const STATUS_ALL = 'all'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatTimeAgo(dateStr: string, t: any): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('time.just_now')
  if (mins < 60) return t('time.m_ago', { m: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('time.h_ago', { h: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('time.d_ago', { d: days })
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return t('time.w_ago', { w: weeks })
  const locale = typeof window !== 'undefined' ? window.navigator.language : 'en'
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const locale = typeof window !== 'undefined' ? window.navigator.language : 'en'
  return d.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.other
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { color: '#6B7280' }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-xs p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-20 bg-slate-100 rounded-full" />
        <div className="h-5 w-16 bg-slate-100 rounded-full" />
      </div>
      <div className="h-5 w-3/4 bg-slate-100 rounded mb-2" />
      <div className="h-4 w-full bg-slate-50 rounded mb-1" />
      <div className="h-4 w-2/3 bg-slate-50 rounded mb-4" />
      <div className="flex items-center gap-4">
        <div className="h-4 w-16 bg-slate-50 rounded" />
        <div className="h-4 w-10 bg-slate-50 rounded" />
        <div className="h-4 w-10 bg-slate-50 rounded" />
        <div className="h-4 w-20 bg-slate-50 rounded ml-auto" />
      </div>
    </div>
  )
}

// ─── Request Card ─────────────────────────────────────────────────────────────

function RequestCard({
  item,
  isExpanded,
  onToggleExpand,
  onVote,
  comments,
  commentsLoading,
  commentsPagination,
  onLoadMoreComments,
  newCommentText,
  onNewCommentChange,
  onNewCommentSubmit,
  onNewCommentKeyDown,
  submittingComment,
  commentsError,
  onRetryComments,
  apps,
}: {
  item: RequestItem
  isExpanded: boolean
  onToggleExpand: () => void
  onVote: () => void
  comments: Comment[]
  commentsLoading: boolean
  commentsPagination: CommentPagination | null
  onLoadMoreComments: () => void
  newCommentText: string
  onNewCommentChange: (v: string) => void
  onNewCommentSubmit: () => void
  onNewCommentKeyDown: (e: KeyboardEvent) => void
  submittingComment: boolean
  commentsError: boolean
  onRetryComments: () => void
  apps: AppInfo[]
}) {
  const t = useTranslations('apps.inspiration')
  const typeCfg = getTypeConfig(item.type)
  const statusCfg = getStatusConfig(item.status)
  const TypeIcon = typeCfg.icon
  const appName = item.app_slug ? (apps.find(a => a.slug === item.app_slug)?.name ?? item.app_slug) : null

  return (
    <div
      className={`bg-white rounded-xl border border-slate-100 shadow-xs transition-shadow cursor-pointer ${
        isExpanded ? 'shadow-md border-slate-200' : 'hover:shadow-sm'
      }`}
      onClick={onToggleExpand}
    >
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: typeCfg.color + '18', color: typeCfg.color }}
          >
            <TypeIcon size={12} />
            {t(`types.${item.type}` as never)}
          </span>
          <span
            className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: statusCfg.color + '18', color: statusCfg.color }}
          >
            {t(`statuses.${item.status}` as never)}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-slate-800 mb-1.5">{item.title}</h3>
        <p className="text-sm text-slate-500 line-clamp-2 whitespace-pre-line">{item.description}</p>

        <div className="flex items-center gap-3 mt-3 text-xs text-slate-400 flex-wrap">
          {item.creator?.display_name && (
            <span className="inline-flex items-center gap-1" title="Created by">
              <User size={12} />
              <span className="truncate max-w-[100px]">{item.creator.display_name}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1" title="Created">
            {formatTimeAgo(item.created_at, t)}
          </span>
          {appName && (
            <span className="inline-flex items-center gap-1" title="App">
              <ExternalLink size={12} />
              {appName}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onVote() }}
            className={`inline-flex items-center gap-1 font-medium transition-colors cursor-pointer ${
              item.user_has_voted ? 'text-red-500' : 'text-slate-400 hover:text-red-400'
            }`}
            title={item.user_has_voted ? 'Remove support' : 'Support this idea'}
          >
            <Heart size={14} className={item.user_has_voted ? 'fill-current' : ''} />
            <span>{item.vote_count}</span>
          </button>
          <span className="inline-flex items-center gap-1" title="Comments">
            <MessageSquare size={12} />
            {item.comment_count}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4 relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
            className="absolute top-3 right-3 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
            title="Collapse"
          >
            <ChevronUp size={14} />
            <X size={12} />
          </button>
          {/* Full description */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{t('card.description')}</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{item.description}</p>
          </div>

          {/* Comments section */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">{t('comments.title')}</p>

            {commentsError ? (
              <div className="py-2">
                <p className="text-sm text-red-500 mb-2">{t('comments.error')}</p>
                <button
                  type="button"
                  onClick={onRetryComments}
                  className="text-xs text-blue-500 cursor-pointer"
                >
                  {t('comments.retry')}
                </button>
              </div>
            ) : commentsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={16} className="animate-spin text-slate-200" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">{t('comments.empty')}</p>
            ) : (
              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 text-xs font-medium text-violet-600">
                      {c.user?.display_name?.[0]?.toUpperCase() ?? c.user_id?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-700">
                          {c.user?.display_name ?? t('card.user')}
                        </span>
                        <span className="text-xs text-slate-400">{formatTimeAgo(c.created_at, t)}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-line">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {commentsPagination && comments.length < commentsPagination.total && (
              <button
                type="button"
                onClick={onLoadMoreComments}
                className="text-xs font-medium mt-2 cursor-pointer"
                style={{ color: 'var(--app-primary)' }}
              >
                {t('card.load_more')}
              </button>
            )}

            {/* New comment input */}
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => onNewCommentChange(e.target.value)}
                onKeyDown={onNewCommentKeyDown}
                placeholder={t('comments.placeholder')}
                className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white placeholder:text-slate-400 transition-colors"
              />
              <button
                type="button"
                onClick={onNewCommentSubmit}
                disabled={submittingComment || !newCommentText.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white rounded-lg cursor-pointer disabled:opacity-50 transition-colors"
                style={{ backgroundColor: 'var(--app-primary)' }}
              >
                {submittingComment ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  t('card.send')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Changelog Item ───────────────────────────────────────────────────────────

function ChangelogItem({ item, apps }: { item: RequestItem; apps: AppInfo[] }) {
  const t = useTranslations('apps.inspiration')
  const typeCfg = getTypeConfig(item.type)
  const TypeIcon = typeCfg.icon
  const appName = item.app_slug ? (apps.find(a => a.slug === item.app_slug)?.name ?? item.app_slug) : null

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-xs p-4 flex items-start gap-3">
      <div className="shrink-0 mt-0.5">
        <CheckCircle2 size={18} style={{ color: 'var(--app-primary)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: typeCfg.color + '14', color: typeCfg.color }}
          >
            <TypeIcon size={10} />
            {t(`types.${item.type}` as never)}
          </span>
          {appName && (
            <span className="text-xs text-slate-400">· {appName}</span>
          )}
          <span className="text-xs text-slate-400">{formatDateFull(item.created_at)}</span>
        </div>
        <p className="text-sm font-medium text-slate-700 mt-1">{item.title}</p>
        <p className="text-sm text-slate-500 mt-0.5 line-clamp-2 whitespace-pre-line">{item.description}</p>
        {item.creator?.display_name && (
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <User size={12} />
            {item.creator.display_name}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function InspirationView() {
  const { groupSlug } = useAppContext()
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations('apps.inspiration')

  const SORT_OPTIONS = [
    { value: 'newest', label: t('filters.sort_newest'), icon: Clock },
    { value: 'oldest', label: t('filters.sort_oldest'), icon: Clock },
    { value: 'most_supported', label: t('filters.sort_most_supported'), icon: Flame },
    { value: 'most_commented', label: t('filters.sort_most_commented'), icon: MessageSquare },
  ] as const

  // ─── Filter state (synced from URL) ──────────────────────────────────────

  const searchQuery = searchParams.get('search') ?? ''
  const typeFilter = searchParams.get('type')?.split(',').filter(Boolean) ?? [TYPE_ALL]
  const statusFilter = searchParams.get('status') ?? STATUS_ALL
  const sortBy = searchParams.get('sort') ?? 'newest'
  const viewTab = searchParams.get('tab') ?? 'active'
  const myIdeas = searchParams.get('my') === '1'

  const [refreshCounter, setRefreshCounter] = useState(0)
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)

  // Sync localSearch when URL changes externally (browser back/forward)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    setLocalSearch(urlSearch)
  }, [searchParams])

  // ─── Data state ───────────────────────────────────────────────────────────

  const [requests, setRequests] = useState<RequestItem[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, total_pages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [counts, setCounts] = useState({ total: 0, pending: 0, completed: 0 })
  const [apps, setApps] = useState<AppInfo[]>([])

  // Expanded card state
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsPagination, setCommentsPagination] = useState<CommentPagination | null>(null)
  const [commentsPage, setCommentsPage] = useState(1)
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false)
  const [commentsError, setCommentsError] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Vote loading tracking
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set())

  // ─── Fetch data ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!groupSlug) {
      setLoading(false)
      return
    }

    const abort = new AbortController()
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(false)

      try {
        // Build API params inside the effect to break the reference-equality loop
        const params = new URLSearchParams()
        params.set('sort', searchParams.get('sort') ?? 'newest')
        params.set('page', searchParams.get('page') || '1')
        params.set('limit', '20')

        const tab = searchParams.get('tab') ?? 'active'
        const typeRaw = searchParams.get('type') ?? ''
        const statusRaw = searchParams.get('status') ?? STATUS_ALL
        const myRaw = searchParams.get('my')
        const searchRaw = searchParams.get('search') ?? ''

        if (tab === 'changelog') {
          params.set('status', 'completed')
        } else if (statusRaw !== STATUS_ALL) {
          params.set('status', statusRaw)
        }

        if (typeRaw && typeRaw !== TYPE_ALL) {
          params.set('type', typeRaw)
        }

        if (myRaw === '1') params.set('my', '1')
        if (searchRaw) params.set('search', searchRaw)
        params.set('include_counts', 'true')

        const apiParams = params.toString()

        const res = await fetchWithAuth(`/api/v1/${groupSlug}/apps/inspiration?${apiParams}`, {
          signal: abort.signal,
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const { data, pagination: pag, counts: apiCounts } = await res.json()

        if (cancelled) return
        setRequests(data ?? [])
        setPagination(pag ?? { page: 1, limit: 20, total: 0, total_pages: 0 })

        // Counts come from the main response (include_counts=true)
        if (apiCounts) {
          setCounts({ total: apiCounts.total ?? 0, pending: apiCounts.pending ?? 0, completed: apiCounts.completed ?? 0 })
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true; abort.abort() }
  }, [groupSlug, searchParams, refreshCounter])

  // Fetch installed apps for app_slug display
  useEffect(() => {
    if (!groupSlug) return
    fetchWithAuth(`/api/v1/${groupSlug}/apps/inspiration/apps`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => setApps(data.apps ?? []))
      .catch(() => setApps([]))
  }, [groupSlug])

  // ─── URL sync helpers ────────────────────────────────────────────────────

  const updateUrl = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === '' || value === TYPE_ALL || value === STATUS_ALL || value === 'newest' || (key === 'tab' && value === 'active') || (key === 'my' && value === '')) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    const qs = params.toString()
    router.push(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }, [searchParams, router])

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      updateUrl({ search: value })
    }, 300)
  }, [updateUrl])

  const handleTypeToggle = useCallback((type: string) => {
    if (type === TYPE_ALL) {
      updateUrl({ type: '' })
      return
    }
    const current = typeFilter.includes(TYPE_ALL) ? [] : [...typeFilter]
    const idx = current.indexOf(type)
    if (idx >= 0) {
      current.splice(idx, 1)
      if (current.length === 0) {
        updateUrl({ type: TYPE_ALL })
        return
      }
    } else {
      current.push(type)
    }
    updateUrl({ type: current.join(',') })
  }, [typeFilter, updateUrl])

  const handleStatusChange = useCallback((status: string) => {
    updateUrl({ status })
  }, [updateUrl])

  const handleSortChange = useCallback((sort: string) => {
    updateUrl({ sort })
  }, [updateUrl])

  const handleMyIdeasToggle = useCallback(() => {
    updateUrl({ my: myIdeas ? '' : '1' })
  }, [updateUrl, myIdeas])

  const handleTabChange = useCallback((tab: string) => {
    setExpandedId(null)
    updateUrl({ tab })
  }, [updateUrl])

  const handlePageChange = useCallback((newPage: number) => {
    updateUrl({ page: String(newPage) })
  }, [updateUrl])

  // ─── Vote ────────────────────────────────────────────────────────────────

  const handleVote = async (requestId: string, currentVoted: boolean, currentCount: number) => {
    if (votingIds.has(requestId)) return

    // Save previous state for rollback
    const prevVoted = currentVoted
    const prevCount = currentCount

    setVotingIds(prev => new Set(prev).add(requestId))

    // Optimistic update
    setRequests(prev => prev.map(r => {
      if (r.id !== requestId) return r
      return {
        ...r,
        user_has_voted: !prevVoted,
        vote_count: prevVoted ? Math.max(0, prevCount - 1) : prevCount + 1,
      }
    }))

    try {
      const res = await fetchWithAuth(`/api/v1/${groupSlug}/apps/inspiration/${requestId}/vote`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Vote failed')
      const { voted, vote_count } = await res.json()

      // Reconcile with server
      setRequests(prev => prev.map(r =>
        r.id === requestId ? { ...r, user_has_voted: voted, vote_count } : r,
      ))
    } catch {
      // Rollback to previous state
      setRequests(prev => prev.map(r =>
        r.id === requestId ? { ...r, user_has_voted: prevVoted, vote_count: prevCount } : r,
      ))
    } finally {
      setVotingIds(prev => {
        const next = new Set(prev)
        next.delete(requestId)
        return next
      })
    }
  }

  // ─── Expand/Collapse ─────────────────────────────────────────────────────

  const handleToggleExpand = useCallback((id: string) => {
    // Abort previous fetch if any
    if (abortRef.current) abortRef.current.abort()

    if (expandedId === id) {
      setExpandedId(null)
      setComments([])
      setCommentsPagination(null)
      setNewCommentText('')
      return
    }

    setExpandedId(id)
    setComments([])
    setCommentsPagination(null)
    setNewCommentText('')
    setCommentsPage(1)
    setCommentsError(false)
    setCommentsLoadingMore(false)

    // Load comments
    setCommentsLoading(true)
    const abort = new AbortController()
    abortRef.current = abort

    fetchWithAuth(
      `/api/v1/${groupSlug}/apps/inspiration/${id}/comments?page=1&limit=20`,
      { signal: abort.signal },
    )
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(({ data, pagination: pag }) => {
        if (!abort.signal.aborted) {
          setComments(data ?? [])
          setCommentsPagination(pag ?? { page: 1, limit: 20, total: 0, total_pages: 0 })
          setCommentsLoading(false)
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setCommentsError(true)
          setCommentsLoading(false)
        }
      })
  }, [expandedId, groupSlug])

  // ─── Comments ────────────────────────────────────────────────────────────

  const handleLoadMoreComments = useCallback(async () => {
    if (!expandedId) return
    if (commentsLoadingMore || commentsLoading) return
    const nextPage = commentsPage + 1
    if (commentsPagination && nextPage > commentsPagination.total_pages) return

    setCommentsLoadingMore(true)
    try {
      const res = await fetchWithAuth(
        `/api/v1/${groupSlug}/apps/inspiration/${expandedId}/comments?page=${nextPage}&limit=20`,
      )
      if (res.ok) {
        const { data, pagination: pag } = await res.json()
        setComments(prev => [...prev, ...(data ?? [])])
        setCommentsPagination(pag)
        setCommentsPage(nextPage)
      }
    } catch {
      setCommentsError(true)
    } finally {
      setCommentsLoadingMore(false)
    }
  }, [expandedId, groupSlug, commentsPage, commentsLoadingMore, commentsLoading, commentsPagination])

  const handleSubmitComment = useCallback(async () => {
    if (!expandedId || !newCommentText.trim() || submittingComment) return
    setSubmittingComment(true)

    try {
      const res = await fetchWithAuth(
        `/api/v1/${groupSlug}/apps/inspiration/${expandedId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: newCommentText.trim() }),
        },
      )
      if (res.ok) {
        const comment = await res.json()
        setComments(prev => [...prev, comment])
        setNewCommentText('')
        // Update comment count in the request list
        setRequests(prev => prev.map(r =>
          r.id === expandedId ? { ...r, comment_count: r.comment_count + 1 } : r,
        ))
      }
    } catch { /* ignore */ }
    setSubmittingComment(false)
  }, [expandedId, newCommentText, submittingComment, groupSlug])

  const handleCommentKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmitComment()
    }
  }, [handleSubmitComment])

  const handleRetryComments = useCallback(() => {
    if (!expandedId) return
    setCommentsError(false)
    setCommentsLoading(true)
    setCommentsLoadingMore(false)
    const abort = new AbortController()
    abortRef.current = abort

    fetchWithAuth(
      `/api/v1/${groupSlug}/apps/inspiration/${expandedId}/comments?page=1&limit=20`,
      { signal: abort.signal },
    )
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(({ data, pagination: pag }) => {
        if (!abort.signal.aborted) {
          setComments(data ?? [])
          setCommentsPagination(pag ?? { page: 1, limit: 20, total: 0, total_pages: 0 })
          setCommentsLoading(false)
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setCommentsError(true)
          setCommentsLoading(false)
        }
      })
  }, [expandedId, groupSlug])

  // ─── Derived state ───────────────────────────────────────────────────────

  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const viewFrom = requests.length > 0 ? ((currentPage - 1) * pagination.limit + 1) : 0
  const viewTo = Math.min(viewFrom + requests.length - 1, pagination.total)
  const isChangelog = viewTab === 'changelog'
  const totalPages = pagination.total_pages

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!groupSlug) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--app-primary)', color: '#fff' }}
          >
            <Lightbulb size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('title')}</h1>
            <p className="text-xs text-slate-400">
              {t('card.counts', { total: counts.total, active: counts.pending, completed: counts.completed })}
            </p>
          </div>
        </div>
        {!isChangelog && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer transition-colors"
            style={{ backgroundColor: 'var(--app-primary)' }}
          >
            <Plus size={16} />
            {t('new_idea')}
          </button>
        )}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      {!isChangelog && (
        <div className="space-y-4 mb-6">
          {/* Search (always visible) */}
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t('filters.search_placeholder')}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white placeholder:text-slate-400 transition-colors"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {/* Mobile filter toggle */}
            <button
              type="button"
              onClick={() => setShowMobileFilters(true)}
              className="sm:hidden inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <SlidersHorizontal size={16} />
              {t('filters.title')}
            </button>
          </div>

          {/* Desktop filters (hidden on mobile) */}
          <div className="hidden sm:block space-y-4">
            {/* Sort dropdown */}
            <div className="w-full sm:w-auto">
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 cursor-pointer transition-colors"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Type chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[{ value: TYPE_ALL, label: t('card.all') }, ...Object.entries(TYPE_CONFIG).map(([k, v]) => ({ value: k, label: t(`types.${k}` as never), icon: v.icon, color: v.color }))].map((chip: { value: string; label: string; icon?: ComponentType<{ size?: number; className?: string }>; color?: string }) => {
                const isActive = typeFilter.includes(chip.value) || (chip.value === TYPE_ALL && typeFilter.includes(TYPE_ALL))
                const TypeIcon = chip.icon
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => handleTypeToggle(chip.value)}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                    }`}
                    style={isActive ? { backgroundColor: chip.value === TYPE_ALL ? '#6B7280' : chip.color ?? '#6B7280' } : undefined}
                  >
                    {TypeIcon && <TypeIcon size={12} />}
                    {chip.label}
                  </button>
                )
              })}
            </div>

            {/* Status chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleStatusChange(STATUS_ALL)}
                className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                  statusFilter === STATUS_ALL
                    ? 'text-white'
                    : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                }`}
                style={statusFilter === STATUS_ALL ? { backgroundColor: '#6B7280' } : undefined}
              >
                {t('card.all')}
              </button>
              {['pending', 'reviewing', 'approved', 'in_progress', 'completed'].map(st => {
                const cfg = getStatusConfig(st)
                const isActive = statusFilter === st
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(isActive ? STATUS_ALL : st)}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                      isActive ? 'text-white' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                    }`}
                    style={isActive ? { backgroundColor: cfg.color } : undefined}
                  >
                    {t(`statuses.${st}` as never)}
                  </button>
                )
              })}
            </div>

            {/* My ideas toggle */}
            <button
              type="button"
              onClick={handleMyIdeasToggle}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors ${
                myIdeas ? 'text-white bg-violet-600' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <User size={14} />
              {t('filters.my_ideas')}
            </button>
          </div>

          {/* Active filter pills on mobile */}
          <div className="sm:hidden flex items-center gap-1.5 flex-wrap">
            {statusFilter !== STATUS_ALL && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {t(`statuses.${statusFilter}` as never)}
                <button type="button" onClick={() => handleStatusChange(STATUS_ALL)} className="cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {typeFilter.filter(t => t !== TYPE_ALL).map(type => {
              const cfg = getTypeConfig(type)
              const TypeIcon = cfg.icon
              return (
                <span key={type} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.color + '18', color: cfg.color }}>
                  {TypeIcon && <TypeIcon size={12} />}
                  {t(`types.${type}` as never)}
                  <button type="button" onClick={() => handleTypeToggle(type)} className="cursor-pointer opacity-60 hover:opacity-100"><X size={12} /></button>
                </span>
              )
            })}
            {myIdeas && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">
                <User size={12} />
                {t('filters.my_ideas')}
                <button type="button" onClick={handleMyIdeasToggle} className="cursor-pointer"><X size={12} /></button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile Filters Modal ─────────────────────────────────────────── */}
      {showMobileFilters && (
        <div
          className="fixed inset-0 z-50 bg-black/40 sm:hidden"
          onClick={() => setShowMobileFilters(false)}
        >
          <div
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-slate-900">{t('filters.sort_newest')}</h3>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sort */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{t('filters.sort_newest')}</label>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSortChange(opt.value)}
                    className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${
                      sortBy === opt.value ? 'bg-violet-100 text-violet-700 font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{t('filters.type_label')}</label>
              <div className="flex flex-wrap gap-2">
                {[{ value: TYPE_ALL, label: t('card.all') }, ...Object.entries(TYPE_CONFIG).map(([k, v]) => ({ value: k, label: t(`types.${k}` as never), icon: v.icon, color: v.color }))].map((chip: { value: string; label: string; icon?: ComponentType<{ size?: number; className?: string }>; color?: string }) => {
                  const isActive = typeFilter.includes(chip.value) || (chip.value === TYPE_ALL && typeFilter.includes(TYPE_ALL))
                  const TypeIcon = chip.icon
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => handleTypeToggle(chip.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${
                        isActive ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      style={isActive ? { backgroundColor: chip.value === TYPE_ALL ? '#6B7280' : chip.color ?? '#6B7280' } : undefined}
                    >
                      {TypeIcon && <TypeIcon size={14} />}
                      {chip.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Status */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{t('filters.status_label')}</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange(STATUS_ALL)}
                  className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${
                    statusFilter === STATUS_ALL ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t('card.all')}
                </button>
                {['pending', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected', 'on_hold', 'duplicate'].map(st => {
                  const cfg = getStatusConfig(st)
                  const isActive = statusFilter === st
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStatusChange(isActive ? STATUS_ALL : st)}
                      className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${
                        isActive ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      style={isActive ? { backgroundColor: cfg.color } : undefined}
                    >
                      {t(`statuses.${st}` as never)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* My ideas toggle */}
            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={() => { handleMyIdeasToggle(); setShowMobileFilters(false) }}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                  myIdeas ? 'text-violet-700 bg-violet-50 font-medium' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <User size={16} />
                {t('filters.my_ideas')}
              </button>
            </div>

            <hr className="border-t border-slate-100 mb-4" />

            <button
              type="button"
              onClick={() => setShowMobileFilters(false)}
              className="w-full py-3 text-sm font-semibold text-white bg-violet-600 rounded-xl cursor-pointer hover:bg-violet-700 shadow-sm transition-colors"
            >
              {t('filters.apply')}
            </button>
          </div>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => handleTabChange('active')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            !isChangelog ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('active')}
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('changelog')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            isChangelog ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('changelog')}
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}

      {error ? (
        /* Error state */
        <div className="text-center py-16">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <X size={24} className="text-red-400" />
          </div>
          <p className="text-sm text-slate-500 mb-4">{t('card.error_loading')}</p>
          <button
            type="button"
            onClick={() => setRefreshCounter(c => c + 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer transition-colors"
            style={{ backgroundColor: 'var(--app-primary)' }}
          >
            {t('card.error_retry')}
          </button>
        </div>
      ) : loading ? (
        /* Loading state */
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : requests.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16">
          <div
            className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--app-primary)18' }}
          >
            <Lightbulb size={28} style={{ color: 'var(--app-primary)' }} />
          </div>
          {searchQuery || !typeFilter.includes(TYPE_ALL) || statusFilter !== STATUS_ALL ? (
            <>
              <p className="text-sm text-slate-500 mb-1">{t('card.filtered')}</p>
              <p className="text-xs text-slate-400">{t('card.filtered_hint')}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-1">{t('card.no_ideas_first')}</p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer transition-colors"
                style={{ backgroundColor: 'var(--app-primary)' }}
              >
                <Plus size={16} />
                {t('new_idea')}
              </button>
            </>
          )}
        </div>
      ) : isChangelog ? (
        /* Changelog view */
        <div className="space-y-3">
          {requests.map(item => (
            <ChangelogItem key={item.id} item={item} apps={apps} />
          ))}
        </div>
      ) : (
        /* Active cards view */
        <div className="space-y-3">
          {requests.map(item => (
            <RequestCard
              key={item.id}
              item={item}
              isExpanded={expandedId === item.id}
              onToggleExpand={() => handleToggleExpand(item.id)}
              onVote={() => handleVote(item.id, item.user_has_voted, item.vote_count)}
              comments={expandedId === item.id ? comments : []}
              commentsLoading={expandedId === item.id ? commentsLoading : false}
              commentsPagination={expandedId === item.id ? commentsPagination : null}
              onLoadMoreComments={handleLoadMoreComments}
              newCommentText={expandedId === item.id ? newCommentText : ''}
              onNewCommentChange={(v) => expandedId === item.id && setNewCommentText(v)}
              onNewCommentSubmit={handleSubmitComment}
              onNewCommentKeyDown={handleCommentKeyDown}
              submittingComment={submittingComment}
              commentsError={expandedId === item.id ? commentsError : false}
              onRetryComments={handleRetryComments}
              apps={apps}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {!loading && requests.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            {viewFrom}&ndash;{viewTo} {t('card.of')} {pagination.total}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {t('pagination.prev')}
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
              const page = start + i
              if (page > totalPages) return null
              const isCurrent = page === currentPage
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {page}
                </button>
              )
            })}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {t('pagination.next')}
            </button>
          </div>
        </div>
      )}

      {/* ── Create Request Modal ────────────────────────────────────────── */}
      <CreateRequestModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={() => {
          setShowModal(false)
          setRefreshCounter(c => c + 1)
        }}
        groupSlug={groupSlug}
      />
    </div>
  )
}
