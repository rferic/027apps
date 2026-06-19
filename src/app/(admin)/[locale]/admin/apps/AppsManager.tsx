'use client'
import Image from 'next/image'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale, useMessages } from 'next-intl'
import { Package, CheckCircle, XCircle, Loader2, AlertTriangle, Info } from 'lucide-react'
import { installAppAction, uninstallAppAction, updateAppVisibilityAction } from '@/lib/apps/actions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AppDetailDrawer } from '@/components/app-detail-drawer'
import type { CombinedApp } from '@/types/apps'

interface Props {
  initialApps: CombinedApp[]
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('admin.apps')
  const statusColorMap: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    installing: 'bg-blue-50 text-blue-700',
    uninstalling: 'bg-amber-50 text-amber-700',
    error: 'bg-red-50 text-red-600',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColorMap[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {t(`status.${status}` as Parameters<typeof t>[0])}
    </span>
  )
}

function AppCard({ app }: { app: CombinedApp }) {
  const t = useTranslations('admin.apps')
  const tErrors = useTranslations('apps.errors')
  const allMessages = useMessages()
  const appDescription = (allMessages as Record<string, any>)?.apps?.[app.slug]?.description
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const [isPendingVisibility, startVisibilityTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  const isInstalled = app.installed !== null
  const isActive = app.installed?.status === 'active'
  const isBusy = app.installed?.status === 'installing' || app.installed?.status === 'uninstalling'

  function handleInstall() {
    setError(null)
    startTransition(async () => {
      const res = await installAppAction(app.slug)
      if ('errorCode' in res) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setError(tErrors(res.errorCode as any, res.errorParams as any))
      }
    })
  }

  function handleUninstall() {
    setError(null)
    startTransition(async () => {
      const res = await uninstallAppAction(app.slug)
      if ('errorCode' in res) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setError(tErrors(res.errorCode as any, res.errorParams as any))
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {app.manifest ? (
            <Image unoptimized
              src={`/api/apps/${app.slug}/logo`}
              alt={app.manifest.name}
              width={40}
              height={40}
              className="flex-shrink-0 w-10 h-10 rounded-lg"
            />
          ) : (
            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold bg-slate-300">
              {app.slug.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">{app.manifest?.name ?? app.slug}</span>
              {app.manifest && <span className="text-xs text-gray-400">v{app.manifest.version}</span>}
              {app.manifest && (
                <button
                  type="button"
                  onClick={() => setShowDetail(true)}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                  title="App details"
                >
                  <Info size={14} />
                </button>
              )}
              {app.installed && <StatusBadge status={app.installed.status} />}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{appDescription ?? app.slug}</p>
            {app.manifest?.author?.name && (
              <p className="text-xs text-gray-400 mt-0.5">{app.manifest.author.name}</p>
            )}
            {app.validationError && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={11} />
                {app.validationError}
              </p>
            )}
            {app.installed?.error && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <XCircle size={11} />
                {app.installed.error}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
          {isInstalled && isActive && app.manifest?.views.admin && (
            <Link
              href={`/${locale}/admin/apps/${app.slug}`}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 cursor-pointer transition-colors"
            >
              {t('manageTab')}
            </Link>
          )}
          {isInstalled && isActive && (app.manifest?.config?.length ?? 0) > 0 && (
            <Link
              href={`/${locale}/admin/apps/${app.slug}#config`}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              {t('configure')}
            </Link>
          )}

          {!isInstalled && !app.validationError && (
            <button
              type="button"
              onClick={handleInstall}
              disabled={isPending}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50 transition-colors"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              {t('install')}
            </button>
          )}

          {isInstalled && !isBusy && (
            <button
              type="button"
              onClick={() => setShowUninstallConfirm(true)}
              disabled={isPending}
              className="flex items-center gap-1.5 border border-red-200 bg-red-50 text-red-700 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50 transition-colors hover:bg-red-100"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
              {t('uninstall')}
            </button>
          )}

          {isBusy && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" />
              {t('processing')}
            </span>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <ConfirmDialog
        open={showUninstallConfirm}
        onOpenChange={setShowUninstallConfirm}
        title={t('uninstall_confirm_title')}
        description={t('uninstall_confirm_description')}
        confirmLabel={t('uninstall_confirm_button')}
        cancelLabel={t('cancel')}
        onConfirm={() => { setShowUninstallConfirm(false); handleUninstall() }}
        loading={isPending}
        variant="destructive"
      />

      {isActive && (
        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
          <span className="text-xs text-gray-500">{t('visibility.label')}</span>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
            {(['public', 'private'] as const).map((v) => (
              <button
                key={v}
                type="button"
                disabled={isPendingVisibility}
                onClick={() => {
                  if (app.installed?.visibility === v) return
                  startVisibilityTransition(async () => {
                    await updateAppVisibilityAction(app.slug, v)
                  })
                }}
                className={`cursor-pointer px-3 py-1.5 transition-colors disabled:opacity-50 ${
                  app.installed?.visibility === v
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-gray-500 hover:bg-slate-50'
                }`}
              >
                {t(`visibility.${v}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>
      )}

      {showDetail && app.manifest && (
        <AppDetailDrawer
          manifest={app.manifest}
          open={showDetail}
          onOpenChange={setShowDetail}
        />
      )}
    </div>
  )
}

export function AppsManager({ initialApps }: Props) {
  const t = useTranslations('admin.apps')

  if (initialApps.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-10 text-center">
        <Package size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">{t('empty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {initialApps.map(app => (
        <AppCard key={app.slug} app={app} />
      ))}
    </div>
  )
}
