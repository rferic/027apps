// TODO i18n: TASK-95 — All user-facing strings are hardcoded in English.
// Replace with useTranslations('apps.inspiration') once translations are defined.

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Lightbulb, Search, Bug, Sparkles, AppWindow, Puzzle, MoreHorizontal,
  ArrowUp, MessageSquare, Plus, X, Loader2, ChevronDown,
  CheckCircle2, Flame, Clock, User,
} from 'lucide-react'
import { useAppContext } from '@/lib/apps/context'
import CreateRequestModal from './CreateRequestModal'

// ─── Types ───────────────────────────────────────────────────────────────────

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

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; label: string }> = {
  bug: { icon: Bug, color: '#EF4444', label: 'Bug' },
  improvement: { icon: Sparkles, color: '#F59E0B', label: 'Improvement' },
  new_app: { icon: AppWindow, color: '#8B5CF6', label: 'New app' },
  new_app_feature: { icon: Puzzle, color: '#3B82F6', label: 'App feature' },
  new_general_functionality: { icon: Lightbulb, color: '#10B981', label: 'Functionality' },
  other: { icon: MoreHorizontal, color: '#6B7280', label: 'Other' },
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: '#F59E0B', label: 'Pending' },
  reviewing: { color: '#3B82F6', label: 'Reviewing' },
  approved: { color: '#10B981', label: 'Approved' },
  in_progress: { color: '#F97316', label: 'In progress' },
  completed: { color: '#7C3AED', label: 'Completed' },
  rejected: { color: '#EF4444', label: 'Rejected' },
  on_hold: { color: '#6B7280', label: 'On hold' },
  duplicate: { color: '#8B5CF6', label: 'Duplicate' },
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest', icon: Clock },
  { value: 'oldest', label: 'Oldest', icon: Clock },
  { value: 'most_supported', label: 'Most supported', icon: Flame },
  { value: 'most_commented', label: 'Most commented', icon: MessageSquare },
] as const

const ACTIVE_STATUSES = 'pending,reviewing,approved,in_progress,on_hold'

const TYPE_ALL = 'all'
const STATUS_ALL = 'all'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.other
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { color: '#6B7280', label: status }
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
  onNewCommentKeyDown: (e: React.KeyboardEvent) => void
  submittingComment: boolean
  commentsError: boolean
  onRetryComments: () => void
  apps: AppInfo[]
}) {
  const typeCfg = getTypeConfig(item.type)
  const statusCfg = getStatusConfig(item.status)
  const TypeIcon = typeCfg.icon
  const appName = item.app_slug ? (apps.find(a => a.slug === item.app_slug)?.name ?? item.app_slug) : null

  return (
    <div
      className={`bg-white rounded-xl border border-slate-100 shadow-xs transition-shadow ${
        isExpanded ? 'shadow-md border-slate-200' : 'hover:shadow-sm cursor-pointer'
      }`}
      onClick={isExpanded ? undefined : onToggleExpand}
    >
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: typeCfg.color + '18', color: typeCfg.color }}
          >
            <TypeIcon size={12} />
            {typeCfg.label}
          </span>
          <span
            className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: statusCfg.color + '18', color: statusCfg.color }}
          >
            {statusCfg.label}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-slate-800 mb-1.5">{item.title}</h3>
        <p className="text-sm text-slate-500 line-clamp-2 whitespace-pre-line">{item.description}</p>

        <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
          {appName && (
            <span className="inline-flex items-center gap-1">
              <AppWindow size={12} />
              {appName}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onVote() }}
            className={`inline-flex items-center gap-1 font-medium transition-colors cursor-pointer ${
              item.user_has_voted ? 'text-red-500' : 'text-slate-400 hover:text-red-400'
            }`}
          >
            <ArrowUp size={14} className={item.user_has_voted ? 'fill-current' : ''} />
            {item.vote_count}
          </button>
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={12} />
            {item.comment_count}
          </span>
          <span className="inline-flex items-center gap-1 ml-auto">
            <User size={12} />
            {formatTimeAgo(item.created_at)}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          {/* Full description */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Description</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{item.description}</p>
          </div>

          {/* Comments section */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Comments</p>

            {commentsError ? (
              <div className="py-2">
                <p className="text-sm text-red-500 mb-2">Failed to load comments.</p>
                <button
                  type="button"
                  onClick={onRetryComments}
                  className="text-xs text-blue-500 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : commentsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={16} className="animate-spin text-slate-200" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No comments yet. Be the first!</p>
            ) : (
              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 text-xs font-medium text-violet-600">
                      {c.user?.display_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-700">
                          {c.user?.display_name ?? 'User'}
                        </span>
                        <span className="text-xs text-slate-400">{formatTimeAgo(c.created_at)}</span>
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
                Load more ({commentsPagination.total - comments.length} remaining)
              </button>
            )}

            {/* New comment input */}
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => onNewCommentChange(e.target.value)}
                onKeyDown={onNewCommentKeyDown}
                placeholder="Add a comment..."
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
                  'Send'
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
  const typeCfg = getTypeConfig(item.type)
  const TypeIcon = typeCfg.icon
  const appName = item.app_slug ? (apps.find(a => a.slug === item.app_slug)?.name ?? item.app_slug) : null

  return (
    <div className="flex items-start gap-3 py-3 px-1">
      <div className="shrink-0 mt-0.5">
        <CheckCircle2 size={16} style={{ color: 'var(--app-primary)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: typeCfg.color + '14', color: typeCfg.color }}
          >
            <TypeIcon size={10} />
            {typeCfg.label}
          </span>
          {appName && (
            <span className="text-xs text-slate-400">· {appName}</span>
          )}
          <span className="text-xs text-slate-400">{formatDateFull(item.created_at)}</span>
        </div>
        <p className="text-sm font-medium text-slate-700">{item.title}</p>
        <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
      </div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function InspirationView() {
  const { groupSlug } = useAppContext()
  const searchParams = useSearchParams()
  const router = useRouter()

  // ─── Filter state (synced from URL) ──────────────────────────────────────

  const searchQuery = searchParams.get('search') ?? ''
  const typeFilter = searchParams.get('type')?.split(',').filter(Boolean) ?? [TYPE_ALL]
  const statusFilter = searchParams.get('status') ?? STATUS_ALL
  const sortBy = searchParams.get('sort') ?? 'newest'
  const viewTab = searchParams.get('tab') ?? 'active'

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

  // ─── Build API params ────────────────────────────────────────────────────

  const buildApiParams = useCallback((overrides?: Record<string, string>) => {
    const params = new URLSearchParams()
    params.set('sort', sortBy)
    params.set('page', '1')
    params.set('limit', '20')

    if (viewTab === 'changelog') {
      params.set('status', 'completed')
    } else if (overrides?.status) {
      params.set('status', overrides.status)
    } else if (statusFilter !== STATUS_ALL) {
      params.set('status', statusFilter)
    }

    if (overrides?.type) {
      params.set('type', overrides.type)
    } else if (typeFilter.length > 0 && !typeFilter.includes(TYPE_ALL)) {
      params.set('type', typeFilter.join(','))
    }

    const s = overrides?.search ?? searchQuery
    if (s) params.set('search', s)

    return params.toString()
  }, [sortBy, viewTab, statusFilter, typeFilter, searchQuery])

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
        // Main fetch
        const apiParams = buildApiParams()
        const res = await fetch(`/api/v1/${groupSlug}/apps/inspiration?${apiParams}`, {
          credentials: 'include',
          signal: abort.signal,
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const { data, pagination: pag } = await res.json()

        if (cancelled) return
        setRequests(data ?? [])
        setPagination(pag ?? { page: 1, limit: 20, total: 0, total_pages: 0 })

        // Fetch counts (total + pending + completed)
        const countRes = await fetch(
          `/api/v1/${groupSlug}/apps/inspiration?limit=1&page=1`,
          { credentials: 'include', signal: abort.signal },
        )
        if (countRes.ok) {
          const countData = await countRes.json()
          const total = countData.pagination?.total ?? 0

          // Pending count
          const pendingRes = await fetch(
            `/api/v1/${groupSlug}/apps/inspiration?status=${ACTIVE_STATUSES}&limit=1&page=1`,
            { credentials: 'include', signal: abort.signal },
          )
          let pending = 0
          if (pendingRes.ok) {
            const pData = await pendingRes.json()
            pending = pData.pagination?.total ?? 0
          }

          // Completed count
          const completedRes = await fetch(
            `/api/v1/${groupSlug}/apps/inspiration?status=completed&limit=1&page=1`,
            { credentials: 'include', signal: abort.signal },
          )
          let completed = 0
          if (completedRes.ok) {
            const cData = await completedRes.json()
            completed = cData.pagination?.total ?? 0
          }

          if (!cancelled) setCounts({ total, pending, completed })
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true; abort.abort() }
  }, [groupSlug, buildApiParams])

  // Fetch installed apps for app_slug display
  useEffect(() => {
    if (!groupSlug) return
    fetch(`/api/v1/${groupSlug}/apps/inspiration/apps`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => setApps(data.apps ?? []))
      .catch(() => setApps([]))
  }, [groupSlug])

  // ─── URL sync helpers ────────────────────────────────────────────────────

  const updateUrl = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === '' || value === TYPE_ALL || value === STATUS_ALL || value === 'newest' || (key === 'tab' && value === 'active')) {
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

  const handleTabChange = useCallback((tab: string) => {
    setExpandedId(null)
    updateUrl({ tab })
  }, [updateUrl])

  const handleLoadMore = useCallback(async () => {
    const nextPage = pagination.page + 1
    const params = new URLSearchParams(buildApiParams())
    params.set('page', String(nextPage))

    try {
      const res = await fetch(`/api/v1/${groupSlug}/apps/inspiration?${params.toString()}`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const { data } = await res.json()
      setRequests(prev => [...prev, ...(data ?? [])])
      setPagination(prev => ({ ...prev, page: nextPage }))
    } catch { /* ignore */ }
  }, [groupSlug, buildApiParams, pagination.page])

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
      const res = await fetch(`/api/v1/${groupSlug}/apps/inspiration/${requestId}/vote`, {
        method: 'POST',
        credentials: 'include',
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

    fetch(
      `/api/v1/${groupSlug}/apps/inspiration/${id}/comments?page=1&limit=20`,
      { credentials: 'include', signal: abort.signal },
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
      const res = await fetch(
        `/api/v1/${groupSlug}/apps/inspiration/${expandedId}/comments?page=${nextPage}&limit=20`,
        { credentials: 'include' },
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
      const res = await fetch(
        `/api/v1/${groupSlug}/apps/inspiration/${expandedId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
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

  const handleCommentKeyDown = useCallback((e: React.KeyboardEvent) => {
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

    fetch(
      `/api/v1/${groupSlug}/apps/inspiration/${expandedId}/comments?page=1&limit=20`,
      { credentials: 'include', signal: abort.signal },
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

  const showLoadMore = pagination.page < pagination.total_pages
  const viewFrom = requests.length > 0 ? ((pagination.page - 1) * pagination.limit + 1) : 0
  const viewTo = Math.min(viewFrom + requests.length - 1, pagination.total)
  const isChangelog = viewTab === 'changelog'

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
            <h1 className="text-xl font-bold text-slate-900">Inspiration</h1>
            <p className="text-xs text-slate-400">
              {counts.total} total · {counts.pending} active · {counts.completed} completed
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
            New idea
          </button>
        )}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      {!isChangelog && (
        <div className="space-y-4 mb-6">
          {/* Search + Sort */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search ideas..."
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

            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 cursor-pointer transition-colors"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Type chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[{ value: TYPE_ALL, label: 'All' }, ...Object.entries(TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label, color: v.color }))].map(chip => {
              const isActive = typeFilter.includes(chip.value) || (chip.value === TYPE_ALL && typeFilter.includes(TYPE_ALL))
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
                  style={isActive ? { backgroundColor: chip.value === TYPE_ALL ? '#6B7280' : (chip as { color?: string }).color ?? '#6B7280' } : undefined}
                >
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
              All
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
                  {cfg.label}
                </button>
              )
            })}
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
          Active
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('changelog')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            isChangelog ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Changelog
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}

      {error ? (
        /* Error state */
        <div className="text-center py-16">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <X size={24} className="text-red-400" />
          </div>
          <p className="text-sm text-slate-500 mb-4">Something went wrong loading ideas.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer transition-colors"
            style={{ backgroundColor: 'var(--app-primary)' }}
          >
            Retry
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
              <p className="text-sm text-slate-500 mb-1">No ideas match your filters.</p>
              <p className="text-xs text-slate-400">Try adjusting them.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-1">No ideas yet. Be the first!</p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer transition-colors"
                style={{ backgroundColor: 'var(--app-primary)' }}
              >
                <Plus size={16} />
                New idea
              </button>
            </>
          )}
        </div>
      ) : isChangelog ? (
        /* Changelog view */
        <div className="divide-y divide-slate-100">
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
      {!loading && requests.length > 0 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            {viewFrom}&ndash;{viewTo} of {pagination.total}
          </span>
          {showLoadMore && (
            <button
              type="button"
              onClick={handleLoadMore}
              className="text-xs font-medium px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Load more
            </button>
          )}
        </div>
      )}

      {/* ── Create Request Modal ────────────────────────────────────────── */}
      <CreateRequestModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={() => {
          setShowModal(false)
          // Refresh by reloading the page (simplest approach)
          window.location.reload()
        }}
        groupSlug={groupSlug}
      />
    </div>
  )
}
