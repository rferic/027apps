'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Lightbulb, Flame, CheckCircle2, ArrowUp, ArrowRight, Loader2 } from 'lucide-react'
import { useAppContext } from '@/lib/apps/context'

interface InspirationItem {
  id: string
  title: string
  status: string
  vote_count: number
  comment_count: number
  created_at: string
}

export default function InspirationWidget() {
  const { groupSlug } = useAppContext()
  const [activeCount, setActiveCount] = useState<number>(0)
  const [topSupported, setTopSupported] = useState<InspirationItem[]>([])
  const [recentlyCompleted, setRecentlyCompleted] = useState<InspirationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!groupSlug) {
      setLoading(false)
      return
    }

    const abort = new AbortController()

    Promise.allSettled([
      fetch(
        `/api/v1/${groupSlug}/apps/inspiration?status=pending,reviewing,approved,in_progress,on_hold&limit=1&page=1`,
        { credentials: 'include', signal: abort.signal },
      ).then((r) => (r.ok ? r.json() : null)),
      fetch(
        `/api/v1/${groupSlug}/apps/inspiration?sort=most_supported&limit=3&page=1`,
        { credentials: 'include', signal: abort.signal },
      ).then((r) => (r.ok ? r.json() : null)),
      fetch(
        `/api/v1/${groupSlug}/apps/inspiration?status=completed&sort=newest&limit=2&page=1`,
        { credentials: 'include', signal: abort.signal },
      ).then((r) => (r.ok ? r.json() : null)),
    ])
      .then((results) => {
        if (abort.signal.aborted) return

        const activeRes = results[0].status === 'fulfilled' ? results[0].value : null
        const supportedRes = results[1].status === 'fulfilled' ? results[1].value : null
        const completedRes = results[2].status === 'fulfilled' ? results[2].value : null

        setActiveCount(activeRes?.pagination?.total ?? 0)
        setTopSupported(Array.isArray(supportedRes?.data) ? supportedRes.data : [])
        setRecentlyCompleted(Array.isArray(completedRes?.data) ? completedRes.data : [])
        setLoading(false)
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setError(true)
          setLoading(false)
        }
      })

    return () => abort.abort()
  }, [groupSlug])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '\u2014'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (!groupSlug) {
    return (
      <div className="p-4 text-center text-xs text-slate-400">
        Not available
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 size={16} className="animate-spin text-slate-200" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-xs text-slate-400">
        Couldn&apos;t load
      </div>
    )
  }

  const hasData = topSupported.length > 0 || recentlyCompleted.length > 0

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4" style={{ color: 'var(--app-primary)' }} />
          <h3 className="text-sm font-semibold text-slate-700">Inspiration</h3>
        </div>
        {activeCount > 0 && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--app-primary)', color: '#fff' }}
          >
            {activeCount} active
          </span>
        )}
      </div>

      {!hasData ? (
        <p className="text-xs text-slate-400 py-2 text-center">
          No ideas yet. Be the first!
        </p>
      ) : (
        <>
          {/* Most supported */}
          {topSupported.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className="w-3.5 h-3.5" style={{ color: 'var(--app-primary)' }} />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Most supported
                </span>
              </div>
              <div className="space-y-1.5">
                {topSupported.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 truncate flex-1 mr-2 max-w-[65%]">
                      {item.title}
                    </span>
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-0.5 flex-shrink-0">
                      <ArrowUp className="w-3 h-3" style={{ color: 'var(--app-primary)' }} />
                      {item.vote_count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recently completed */}
          {recentlyCompleted.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle2
                  className="w-3.5 h-3.5"
                  style={{ color: 'var(--app-primary)' }}
                />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Recently completed
                </span>
              </div>
              <div className="space-y-1.5">
                {recentlyCompleted.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 truncate flex-1 mr-2 max-w-[65%]">
                      {item.title}
                    </span>
                    <span className="text-xs font-medium text-slate-400 flex-shrink-0">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* View all */}
      <Link
        href="/apps/inspiration"
        className="flex items-center justify-center gap-1 text-xs font-medium mt-3 pt-3 border-t border-slate-100"
        style={{ color: 'var(--app-primary)' }}
      >
        View all ideas <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
