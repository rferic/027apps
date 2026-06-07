'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, ChevronDown, ArrowUp, X, Loader2,
  Bug, Sparkles, AppWindow, Puzzle, Lightbulb, MoreHorizontal,
  ChevronLeft, ChevronRight, MessageCircle, User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

// ---- CONSTANTS ----

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['reviewing', 'rejected', 'duplicate'],
  reviewing: ['approved', 'rejected', 'duplicate'],
  approved: ['in_progress', 'on_hold', 'rejected'],
  in_progress: ['completed', 'on_hold'],
  completed: [],
  rejected: [],
  on_hold: ['in_progress', 'approved'],
  duplicate: [],
}

const FINAL_STATUSES = ['completed', 'rejected', 'duplicate']

// ---- TYPES ----

interface RequestItem {
  id: string
  title: string
  description: string
  type: string
  status: string
  app_slug: string | null
  group_id: string
  group_slug: string | null
  group_name: string | null
  user_id: string
  creator: { display_name: string | null; avatar_url: string | null } | null
  vote_count: number
  comment_count: number
  created_at: string
  updated_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

interface RequestDetail extends RequestItem {
  comments: CommentItem[]
  voters: VoterItem[]
  github_issue_number: number | null
  github_issue_url: string | null
}

interface CommentItem {
  id: string
  body: string
  user_id: string
  created_at: string
  author: { display_name: string | null; avatar_url: string | null } | null
}

interface VoterItem {
  user_id: string
  display_name: string | null
  avatar_url: string | null
}

// ---- COMPONENT ----

export default function InspirationAdmin() {
  const t = useTranslations('apps.inspiration')

  // Constants (moved inside to access t())
  const REQUEST_TYPES = [
    { value: 'bug', label: t('types.bug'), icon: Bug, color: '#EF4444' },
    { value: 'improvement', label: t('types.improvement'), icon: Sparkles, color: '#F59E0B' },
    { value: 'new_app', label: t('types.new_app'), icon: AppWindow, color: '#8B5CF6' },
    { value: 'new_app_feature', label: t('types.new_app_feature'), icon: Puzzle, color: '#3B82F6' },
    { value: 'new_general_functionality', label: t('types.new_general_functionality'), icon: Lightbulb, color: '#10B981' },
    { value: 'other', label: t('types.other'), icon: MoreHorizontal, color: '#6B7280' },
  ] as const

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending: { label: t('statuses.pending'), color: '#F59E0B' },
    reviewing: { label: t('statuses.reviewing'), color: '#3B82F6' },
    approved: { label: t('statuses.approved'), color: '#10B981' },
    in_progress: { label: t('statuses.in_progress'), color: '#F97316' },
    completed: { label: t('statuses.completed'), color: '#7C3AED' },
    rejected: { label: t('statuses.rejected'), color: '#EF4444' },
    on_hold: { label: t('statuses.on_hold'), color: '#6B7280' },
    duplicate: { label: t('statuses.duplicate'), color: '#8B5CF6' },
  }

  const SORT_OPTIONS = [
    { value: 'newest', label: t('filters.sort_newest') },
    { value: 'oldest', label: t('filters.sort_oldest') },
    { value: 'most_supported', label: t('filters.sort_most_supported') },
    { value: 'most_commented', label: t('filters.sort_most_commented') },
  ]

  // Data
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, total_pages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['pending', 'reviewing', 'approved', 'in_progress', 'on_hold']))
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)

  // UI state
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<RequestDetail | null>(null)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const [confirmChange, setConfirmChange] = useState<{ requestId: string; newStatus: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [rowMenuPos, setRowMenuPos] = useState<{ x: number; y: number; requestId: string } | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)


  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sortOpen])

  // Fetch list
  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '20')
    params.set('sort', sort)
    if (search.trim()) params.set('search', search.trim())
    if (selectedTypes.size > 0) params.set('type', [...selectedTypes].join(','))
    if (selectedStatuses.size > 0) params.set('status', [...selectedStatuses].join(','))

    try {
      const res = await fetchWithAuth(`/api/v1/admin/apps/inspiration?${params}`)
      if (!res.ok) {
        if (res.status === 403) throw new Error('Admin access required')
        throw new Error(`Server error (${res.status})`)
      }
      const json = await res.json()
      setRequests(json.data ?? [])
      setPagination(json.pagination ?? { page: 1, limit: 20, total: 0, total_pages: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.error'))
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [page, sort, search, selectedTypes, selectedStatuses])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests()
  }, [fetchRequests])

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchInput])

  // Fetch detail
  const fetchDetail = async (requestId: string) => {
    setDetailLoading(true)
    setSelectedRequestId(requestId)
    setDetail(null)

    try {
      const res = await fetchWithAuth(`/api/v1/admin/apps/inspiration/${requestId}`)
      if (!res.ok) throw new Error('Failed to load detail')
      const data = await res.json()
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedRequestId(null)
    setDetail(null)
  }

  // Filter toggle helpers
  const toggleType = (t: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
    setPage(1)
  }

  const toggleStatus = (s: string) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
    setPage(1)
  }

  // Status change
  const handleStatusChange = async (requestId: string, newStatus: string) => {
    setRowMenuPos(null)

    // Confirm for final statuses
    if (FINAL_STATUSES.includes(newStatus)) {
      setConfirmChange({ requestId, newStatus })
      return
    }

    executeStatusChange(requestId, newStatus)
  }

  const executeStatusChange = async (requestId: string, newStatus: string) => {
    setConfirmChange(null)
    setUpdatingIds(prev => new Set(prev).add(requestId))

    // Optimistic update
    const previousRequests = requests
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r))

    try {
      const res = await fetchWithAuth(`/api/v1/admin/apps/inspiration/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        // Revert
        setRequests(previousRequests)
        const err = await res.json().catch(() => ({}))
        alert(err.message || 'Failed to update status')
      } else {
        // Update detail if open
        if (selectedRequestId === requestId && detail) {
          setDetail({ ...detail, status: newStatus })
        }
      }
    } catch {
      setRequests(previousRequests)
      alert('Network error')
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev)
        next.delete(requestId)
        return next
      })
    }
  }

  // Delete
  const handleDelete = async (requestId: string) => {
    setIsDeleting(true)
    setDeleteTarget(null)

    try {
      const res = await fetchWithAuth(`/api/v1/admin/apps/inspiration/${requestId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.message || 'Failed to delete')
        return
      }

      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== requestId))
      if (selectedRequestId === requestId) closeDetail()
    } catch {
      alert('Network error')
    } finally {
      setIsDeleting(false)
    }
  }

  // GitHub issue link/unlink
  const handleGitHubLink = async (requestId: string) => {
    setLinkingId(requestId)
    setRowMenuPos(null)
    try {
      const res = await fetchWithAuth(
        `/api/v1/admin/apps/inspiration/${requestId}/github-link`,
        { method: 'POST' },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert((err as any).message || t('admin.github.link_error'))
        return
      }
      // Refresh detail if open
      if (selectedRequestId === requestId) fetchDetail(requestId)
      // Refresh list
      fetchRequests()
    } catch {
      alert(t('admin.github.network_error'))
    } finally {
      setLinkingId(null)
    }
  }

  const handleGitHubUnlink = async (requestId: string) => {
    if (!confirm(t('admin.github.unlink_confirm'))) return
    setLinkingId(requestId)
    try {
      const res = await fetchWithAuth(
        `/api/v1/admin/apps/inspiration/${requestId}/github-unlink`,
        { method: 'POST' },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert((err as any).message || t('admin.github.unlink_error'))
        return
      }
      if (selectedRequestId === requestId) fetchDetail(requestId)
      fetchRequests()
    } catch {
      alert(t('admin.github.network_error'))
    } finally {
      setLinkingId(null)
    }
  }

  // Helpers
  const getTypeMeta = (type: string) => REQUEST_TYPES.find(t => t.value === type)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '\u2014'
    const locale = typeof window !== 'undefined' ? window.navigator.language : 'en'
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDateFull = (dateStr: string) => {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '\u2014'
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const truncate = (text: string, max: number) => text.length > max ? text.slice(0, max) + '\u2026' : text

  const getCreatorName = (item: RequestItem) => {
    if (item.creator?.display_name) return item.creator.display_name
    return (item.user_id?.slice(0, 8) ?? t('admin.detail.unknown')) + '\u2026'
  }

  const statusLabel = (s: string) => STATUS_CONFIG[s]?.label ?? s
  const statusColor = (s: string) => STATUS_CONFIG[s]?.color ?? '#6B7280'

  // Escape key for detail panel
  useEffect(() => {
    if (!selectedRequestId) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetail()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedRequestId])

  // ---- RENDER ----

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">{t('admin.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('admin.subtitle')}</p>
      </div>
      {/* Filters */}
      <div className="space-y-3 mb-4">
        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={t('admin.search')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-white placeholder:text-slate-400"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="relative w-full sm:w-auto" ref={sortRef}>
            <button
              type="button"
              onClick={() => setSortOpen(o => !o)}
              className="flex items-center justify-between gap-2 w-full sm:w-auto px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
            >
              <span>{SORT_OPTIONS.find(o => o.value === sort)?.label ?? sort}</span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setSort(opt.value); setPage(1); setSortOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors cursor-pointer ${
                      sort === opt.value ? 'font-medium text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Type chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-slate-500 mr-1">{t('admin.filter.type')}</span>
          {REQUEST_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => toggleType(t.value)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                selectedTypes.has(t.value)
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-slate-500 mr-1">{t('admin.filter.status')}</span>
          {Object.entries(STATUS_CONFIG).map(([value, config]) => (
            <button
              key={value}
              onClick={() => toggleStatus(value)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                selectedStatuses.has(value)
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-300" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
          <p className="text-sm text-red-600 mb-2">{error}</p>
           <button onClick={fetchRequests} className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer">
            {t('admin.retry')}
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && requests.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
           <p className="text-sm text-slate-400">{t('admin.no_ideas_found')}</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && requests.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Table header */}
              <div className="grid grid-cols-[44px_1fr_120px_60px_80px_100px_100px_44px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <span>{t('admin.columns.type')}</span>
                <span>{t('admin.columns.title')}</span>
                <span>{t('admin.columns.creator')}</span>
                <span>{t('admin.columns.votes')}</span>
                <span>{t('admin.columns.app')}</span>
                <span>{t('admin.columns.group')}</span>
                <span>{t('admin.columns.status')}</span>
                <span />
              </div>

              {/* Table body */}
              <div className="divide-y divide-slate-100">
                {requests.map(item => {
                  const typeMeta = getTypeMeta(item.type)
                  const TypeIcon = typeMeta?.icon ?? MoreHorizontal
                  const isUpdating = updatingIds.has(item.id)

                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-[44px_1fr_120px_60px_80px_100px_100px_44px] gap-2 px-4 py-3 items-center hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Type */}
                      <div
                        className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: `${typeMeta?.color ?? '#6B7280'}14` }}
                      >
                        <TypeIcon size={16} style={{ color: typeMeta?.color ?? '#6B7280' }} />
                      </div>

                      {/* Title — clickable for detail */}
                      <button
                        onClick={() => fetchDetail(item.id)}
                        className="text-sm font-medium text-slate-800 text-left truncate cursor-pointer hover:text-slate-600 transition-colors"
                        title={item.title}
                      >
                        {truncate(item.title, 60)}
                      </button>

                      {/* Creator */}
                      <span className="text-xs text-slate-500 truncate" title={getCreatorName(item)}>
                        {getCreatorName(item)}
                      </span>

                      {/* Votes */}
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <ArrowUp size={12} className="text-slate-400" />
                        {item.vote_count}
                      </span>

                      {/* App */}
                      <span className="text-xs text-slate-500 truncate">
                        {item.app_slug ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                            {item.app_slug}
                          </span>
                        ) : (
                          '\u2014'
                        )}
                      </span>

                      {/* Group */}
                      <span className="text-xs text-slate-500 truncate">
                        {item.group_name ?? item.group_slug ?? '\u2014'}
                      </span>

                      {/* Status */}
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap w-fit"
                        style={{ backgroundColor: `${statusColor(item.status)}18`, color: statusColor(item.status) }}
                      >
                        {statusLabel(item.status)}
                      </span>

                      {/* Actions */}
                      <div className="relative flex justify-center">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            setRowMenuPos(rowMenuPos?.requestId === item.id ? null : { x: rect.right - 150, y: rect.bottom + 4, requestId: item.id })
                          }}
                          disabled={isUpdating || VALID_TRANSITIONS[item.status].length === 0}
                          className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          {isUpdating ? (
                            <Loader2 size={16} className="animate-spin text-slate-400" />
                          ) : (
                            <ChevronDown size={16} className="text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-slate-500">
              {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} {t('admin.pagination.of')} {pagination.total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2 sm:px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-slate-50 transition-colors flex items-center gap-1"
              >
                <ChevronLeft size={14} />
                <span className="hidden sm:inline">{t('admin.pagination.prev')}</span>
              </button>
              <span className="text-xs text-slate-500 px-2">
                {pagination.page} / {pagination.total_pages || 1}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                disabled={page >= pagination.total_pages}
                className="px-2 sm:px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-slate-50 transition-colors flex items-center gap-1"
              >
                <span className="hidden sm:inline">{t('admin.pagination.next')}</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ====== ROW MENU (portal) ====== */}
      {rowMenuPos && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50"
          onClick={() => setRowMenuPos(null)}
        >
          <div
            className="absolute bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[150px]"
            style={{ left: rowMenuPos.x, top: rowMenuPos.y }}
            onClick={e => e.stopPropagation()}
          >
              {(() => {
              const request = requests.find(r => r.id === rowMenuPos.requestId)
              if (!request) return null
              return (
                <>
                  {VALID_TRANSITIONS[request.status].map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        handleStatusChange(request.id, status)
                        setRowMenuPos(null)
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor(status) }} />
                      {statusLabel(status)}
                    </button>
                  ))}
                  {(request as any).github_issue_number ? null : (
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        onClick={() => handleGitHubLink(request.id)}
                        disabled={linkingId === request.id}
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {linkingId === request.id ? <Loader2 size={14} className="animate-spin" /> : null}
                        {t('admin.github.generate_issue')}
                      </button>
                    </div>
                  )}
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={() => {
                        setRowMenuPos(null)
                        setDeleteTarget(request.id)
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                    >
                      {t('admin.delete')}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* ====== DETAIL PANEL ====== */}
      {selectedRequestId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={closeDetail} />

          {/* Panel */}
          <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            {detailLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={24} className="animate-spin text-slate-300" />
              </div>
            ) : detail ? (
              <div className="p-6">
                {/* Close */}
                <button onClick={closeDetail} className="absolute top-4 right-4 p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={20} />
                </button>

                {/* Type + Status badges */}
                <div className="flex items-center gap-2 mb-3">
                  {(() => {
                    const tm = getTypeMeta(detail.type)
                    const Icon = tm?.icon ?? MoreHorizontal
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${tm?.color ?? '#6B7280'}14`, color: tm?.color ?? '#6B7280' }}>
                        <Icon size={12} />
                        {tm?.label ?? detail.type}
                      </span>
                    )
                  })()}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${statusColor(detail.status)}18`, color: statusColor(detail.status) }}>
                    {statusLabel(detail.status)}
                  </span>
                </div>

                {/* Title */}
                <h2 className="text-lg font-semibold text-slate-900 mb-2">{detail.title}</h2>

                {/* Description */}
                <div className="text-sm text-slate-600 whitespace-pre-line mb-4 leading-relaxed">
                  {detail.description || t('admin.detail.no_description')}
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
                  {detail.creator && (
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">{t('admin.detail.created_by')}</p>
                      <p className="text-sm text-slate-700 flex items-center gap-1.5">
                        {detail.creator.avatar_url ? (
                          <img src={detail.creator.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                          <User size={14} className="text-slate-400" />
                        )}
                        {detail.creator.display_name ?? t('admin.detail.unknown')}
                      </p>
                    </div>
                  )}
                  {detail.group_name && (
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Group</p>
                      <p className="text-sm text-slate-700">{detail.group_name}</p>
                    </div>
                  )}
                  {detail.app_slug && (
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">App</p>
                      <p className="text-sm text-slate-700">{detail.app_slug}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">{t('admin.detail.created_at')}</p>
                    <p className="text-sm text-slate-700">{formatDateFull(detail.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">{t('admin.detail.updated_at')}</p>
                    <p className="text-sm text-slate-700">{formatDateFull(detail.updated_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">{t('admin.detail.votes_label')}</p>
                    <p className="text-sm text-slate-700">{detail.vote_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">{t('admin.detail.comments_label')}</p>
                    <p className="text-sm text-slate-700">{detail.comment_count}</p>
                  </div>
                </div>

                {/* GitHub */}
                <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                  {detail.github_issue_url ? (
                    <div className="flex items-center justify-between">
                      <a
                        href={detail.github_issue_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {t('admin.github.view_issue')} #{detail.github_issue_number}
                      </a>
                      <button
                        onClick={() => handleGitHubUnlink(detail.id)}
                        disabled={linkingId === detail.id}
                        className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                      >
                        {linkingId === detail.id ? <Loader2 size={12} className="animate-spin" /> : t('admin.github.unlink')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">{t('admin.github.not_linked')}</span>
                      <button
                        onClick={() => handleGitHubLink(detail.id)}
                        disabled={linkingId === detail.id}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                      >
                        {linkingId === detail.id ? <Loader2 size={12} className="animate-spin" /> : null}
                        {t('admin.github.generate_issue')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Comments */}
                {detail.comments && detail.comments.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                      <MessageCircle size={14} />
                      {t('admin.detail.comments_label')} ({detail.comments.length})
                    </h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {detail.comments.map(c => (
                        <div key={c.id} className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-slate-700">
                              {c.author?.display_name ?? (c.user_id?.slice(0, 8) ?? 'User') + '\u2026'}
                            </span>
                            <span className="text-xs text-slate-400">{formatDate(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-600 whitespace-pre-line">{c.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Voters */}
                {detail.voters && detail.voters.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                      <ArrowUp size={14} />
                      {t('admin.detail.voters')} ({detail.voters.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.voters.map((v, i) => (
                        <span key={v.user_id ?? i} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 rounded text-xs text-slate-600">
                          {v.avatar_url ? (
                            <img src={v.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                          ) : (
                            <User size={12} className="text-slate-400" />
                          )}
                          {v.display_name ?? (v.user_id?.slice(0, 8) ?? 'User') + '\u2026'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-slate-400">{t('admin.detail.error')}</div>
            )}
          </div>
        </div>
      )}

      {/* ====== CONFIRM DIALOG for final statuses ====== */}
      {confirmChange && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmChange(null)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-900">{t('admin.confirm_title')}</h3>
            <p className="text-sm text-slate-500">
              {t('admin.confirm_final_status')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmChange(null)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {t('admin.cancel')}
              </button>
              <button
                onClick={() => executeStatusChange(confirmChange.requestId, confirmChange.newStatus)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700 cursor-pointer transition-colors"
              >
                {t('admin.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== DELETE CONFIRM DIALOG ====== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-900">{t('admin.delete_title')}</h3>
            <p className="text-sm text-slate-500">
              {t('admin.delete_confirm')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {t('admin.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer transition-colors flex items-center gap-1"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : null}
                {t('admin.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
