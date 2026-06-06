'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
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
  const ctx = useAppContext()
  const groupSlug = ctx.groupSlug ?? (
    typeof window !== 'undefined'
      ? window.location.pathname.split('/')[2] ?? null
      : null
  )
  const locale = useLocale()
  const t = useTranslations('apps.inspiration')
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

    fetch(
      `/api/v1/${groupSlug}/apps/inspiration?widget=true`,
      { credentials: 'include', signal: abort.signal },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (abort.signal.aborted) return
        setActiveCount(data.active_count ?? 0)
        setTopSupported(Array.isArray(data.top_supported) ? data.top_supported : [])
        setRecentlyCompleted(Array.isArray(data.recently_completed) ? data.recently_completed : [])
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
    const locale = typeof window !== 'undefined' ? window.navigator.language : 'en'
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  }

  if (!groupSlug) {
    return (
      <div className="p-4 text-center text-xs text-slate-400">
        {t('widget.not_available')}
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
        {t('widget.couldnt_load')}
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
          <h3 className="text-sm font-semibold text-slate-700">{t('widget.heading')}</h3>
        </div>
        {activeCount > 0 && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--app-primary)', color: '#fff' }}
          >
            {t('widget.active_ideas', { count: activeCount })}
          </span>
        )}
      </div>

      {!hasData ? (
        <p className="text-xs text-slate-400 py-2 text-center">
          {t('widget.no_ideas')}
        </p>
      ) : (
        <>
          {/* Most supported */}
          {topSupported.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className="w-3.5 h-3.5" style={{ color: 'var(--app-primary)' }} />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {t('widget.most_supported')}
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
                  {t('widget.recently_completed')}
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
        href={`/${locale}/${groupSlug}/apps/inspiration`}
        className="flex items-center justify-center gap-1 text-xs font-medium mt-3 pt-3 border-t border-slate-100"
        style={{ color: 'var(--app-primary)' }}
      >
        {t('widget.view_all')} <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
