'use client'

import { useState, useTransition } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  GitBranch,
  Link2Off,
  Check,
  AlertCircle,
  Loader2,
  Pencil,
  X,
} from 'lucide-react'
import type { GitHubSettings } from './actions'
import {
  generateManifestUrl,
  toggleGitHubSync,
  updateGitHubRepo,
  updateLabelMap,
  disconnectGitHub,
} from './actions'

interface Props {
  initial: GitHubSettings
}

const TYPE_KEYS = ['bug', 'improvement', 'new_app', 'new_app_feature', 'new_general_functionality', 'other']

export function GitHubSettingsManager({ initial }: Props) {
  const t = useTranslations('admin.settings.github')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [settings, setSettings] = useState(initial)
  const [isConnecting, startConnect] = useTransition()
  const [isDisconnecting, startDisconnect] = useTransition()
  const [isToggling, startToggle] = useTransition()
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [showLabelEditor, setShowLabelEditor] = useState(false)
  const [showRepoEditor, setShowRepoEditor] = useState(false)
  const [repoInput, setRepoInput] = useState(settings.repo ?? '')
  const [labelMap, setLabelMap] = useState(settings.labelMap ?? {})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const successParam = searchParams.get('success')
  const errorParam = searchParams.get('error')
  const detailParam = searchParams.get('detail')

  if (successParam && !success) {
    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      router.replace(`/${locale}/admin/settings/github`)
    }, 5000)
  }

  if (errorParam && !error) {
    setError(detailParam ? t('errors.' + errorParam) + ': ' + detailParam : t('errors.' + errorParam))
    setTimeout(() => {
      setError(null)
      router.replace(`/${locale}/admin/settings/github`)
    }, 8000)
  }

  function handleConnect() {
    startConnect(async () => {
      const url = await generateManifestUrl()
      window.location.href = url
    })
  }

  function handleDisconnect() {
    startDisconnect(async () => {
      await disconnectGitHub()
      setSettings({
        connected: false,
        appId: null,
        slug: null,
        installationId: null,
        repo: null,
        syncEnabled: false,
        labelMap: null,
        webhookConfigured: false,
        webhookSecret: null,
      })
      setShowDisconnectConfirm(false)
    })
  }

  function handleToggle() {
    startToggle(async () => {
      await toggleGitHubSync(!settings.syncEnabled)
      setSettings((prev) => ({ ...prev, syncEnabled: !prev.syncEnabled }))
    })
  }

  function handleUpdateRepo() {
    if (!repoInput.trim()) return
    updateGitHubRepo(repoInput.trim()).then(() => {
      setSettings((prev) => ({ ...prev, repo: repoInput.trim() }))
      setShowRepoEditor(false)
    })
  }

  function handleSaveLabels() {
    updateLabelMap(labelMap).then(() => {
      setSettings((prev) => ({ ...prev, labelMap }))
      setShowLabelEditor(false)
    })
  }

  function handleLabelChange(type: string, field: 'name' | 'color', value: string) {
    setLabelMap((prev) => ({
      ...prev,
      [type]: { ...(prev[type] ?? { name: '', color: '000000' }), [field]: value },
    }))
  }

  return (
    <div className="space-y-6">
      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          <Check size={16} />
          {t('connected_success')}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Status card */}
      <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${settings.connected ? 'bg-green-50' : 'bg-gray-50'}`}>
              <GitBranch size={20} className={settings.connected ? 'text-green-600' : 'text-gray-400'} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{t('connection.title')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {settings.connected
                  ? t('connection.connected', { app: settings.slug ?? '—' })
                  : t('connection.not_connected')}
              </p>
            </div>
          </div>

          {!settings.connected ? (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
              {t('connection.connect')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowDisconnectConfirm(true)}
              disabled={isDisconnecting}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isDisconnecting ? <Loader2 size={14} className="animate-spin" /> : <Link2Off size={14} />}
              {t('connection.disconnect')}
            </button>
          )}
        </div>

        {/* Details when connected */}
        {settings.connected && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>{t('connection.app_id')}</span>
              <span className="font-mono text-xs">{settings.appId}</span>
            </div>
            {settings.installationId && (
              <div className="flex justify-between">
                <span>{t('connection.installation_id')}</span>
                <span className="font-mono text-xs">{settings.installationId}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span>{t('connection.repo')}</span>
              {settings.repo ? (
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs">{settings.repo}</span>
                  <button
                    type="button"
                    onClick={() => { setShowRepoEditor(true); setRepoInput(settings.repo ?? '') }}
                    className="p-0.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRepoEditor(true)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                >
                  {t('connection.set_repo')}
                </button>
              )}
            </div>
            <div className="flex justify-between">
              <span>{t('connection.webhook')}</span>
              <span className={`text-xs font-medium ${settings.webhookConfigured ? 'text-green-600' : 'text-amber-600'}`}>
                {settings.webhookConfigured ? t('connection.configured') : t('connection.pending')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Integration toggle */}
      {settings.connected && (
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{t('toggle.title')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{t('toggle.description')}</p>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              disabled={isToggling}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                settings.syncEnabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.syncEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {settings.syncEnabled ? t('toggle.on_note') : t('toggle.off_note')}
          </p>
        </div>
      )}

      {/* Label mapping */}
      {settings.connected && (
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{t('labels.title')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{t('labels.description')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowLabelEditor(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <Pencil size={12} />
              {t('labels.edit')}
            </button>
          </div>
          <div className="space-y-1.5">
            {TYPE_KEYS.map((type) => {
              const label = settings.labelMap?.[type]
              return (
                <div key={type} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: '#' + (label?.color ?? 'ccc') }}
                  />
                  <span className="text-xs font-mono text-gray-500 w-28">{type}</span>
                  <span className="text-gray-700">{label?.name ?? '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Label editor modal */}
      {showLabelEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowLabelEditor(false)} />
          <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">{t('labels.editor.title')}</h3>
              <button
                type="button"
                onClick={() => setShowLabelEditor(false)}
                className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {TYPE_KEYS.map((type) => {
                const label = labelMap[type] ?? { name: '', color: '000000' }
                return (
                  <div key={type} className="text-sm">
                    <p className="text-xs font-medium text-gray-500 mb-1">{type}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={label.name}
                        onChange={(e) => handleLabelChange(type, 'name', e.target.value)}
                        placeholder="Label name"
                        className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
                      />
                      <div className="relative">
                        <input
                          type="text"
                          value={label.color}
                          onChange={(e) => handleLabelChange(type, 'color', e.target.value.replace('#', ''))}
                          placeholder="color"
                          maxLength={6}
                          className="w-16 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
                        />
                        <span
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-gray-200"
                          style={{ backgroundColor: '#' + label.color }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLabelEditor(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                {t('labels.editor.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveLabels}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
              >
                {t('labels.editor.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repo editor modal */}
      {showRepoEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowRepoEditor(false)} />
          <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">{t('repo_editor.title')}</h3>
              <button
                type="button"
                onClick={() => setShowRepoEditor(false)}
                className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="owner/repo"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRepoEditor(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                {t('repo_editor.cancel')}
              </button>
              <button
                type="button"
                onClick={handleUpdateRepo}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
              >
                {t('repo_editor.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect confirm modal */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowDisconnectConfirm(false)} />
          <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('disconnect_confirm.title')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('disconnect_confirm.description')}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                {t('disconnect_confirm.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isDisconnecting ? <Loader2 size={14} className="animate-spin" /> : t('disconnect_confirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
