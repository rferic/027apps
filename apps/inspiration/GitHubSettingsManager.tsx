'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
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
import type { GitHubSettings } from './github-actions'
import {
  saveGitHubCredentials,
  saveWebhookSecret,
  testGitHubConnection,
  toggleGitHubSync,
  updateGitHubRepo,
  updateLabelMap,
  disconnectGitHub,
} from './github-actions'

interface Props {
  initial: GitHubSettings
}

const TYPE_KEYS = ['bug', 'improvement', 'new_app', 'new_app_feature', 'new_general_functionality', 'other']

export function GitHubSettingsManager({ initial }: Props) {
  const t = useTranslations('admin.settings.github')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [settings, setSettings] = useState(initial)
  const [isToggling, startToggle] = useTransition()
  const [isTesting, startTest] = useTransition()
  const [isSaving, startSave] = useTransition()
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  function handleDisconnect() {
    disconnectGitHub().then(() => {
      setSettings({
        ...settings,
        connected: false,
        appId: null,
        installationId: null,
        repo: null,
        syncEnabled: false,
        webhookConfigured: false,
      })
      setShowDisconnectConfirm(false)
    })
  }
  const [showLabelEditor, setShowLabelEditor] = useState(false)
  const [showRepoEditor, setShowRepoEditor] = useState(false)
  const [repoInput, setRepoInput] = useState(settings.repo ?? '')
  const [labelMap, setLabelMap] = useState(settings.labelMap ?? {})
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [success, setSuccess] = useState(false)

  // Manual setup form
  const [appId, setAppId] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [installationId, setInstallationId] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')

  function handleManualSave() {
    const form = new FormData()
    form.set('appId', appId)
    form.set('privateKey', privateKey)
    form.set('installationId', installationId)
    setError(null)

    startSave(async () => {
      const result = await saveGitHubCredentials(form)
      if (result?.error) {
        setError(result.error)
      } else {
        setSettings((prev) => ({ ...prev, connected: true, appId: appId.trim() }))
        setSuccess(true)
        setTimeout(() => setSuccess(false), 5000)
      }
    })
  }

  function handleSaveWebhook() {
    const form = new FormData()
    form.set('webhookSecret', webhookSecret)
    startSave(async () => {
      await saveWebhookSecret(form)
      setSettings((prev) => ({ ...prev, webhookConfigured: true }))
      setSuccess(true)
      setTimeout(() => setSuccess(false), 5000)
    })
  }

  function handleTestConnection() {
    startTest(async () => {
      const result = await testGitHubConnection()
      setTestResult(result)
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

      {/* Connection status */}
      {!settings.connected ? (
        <div className="space-y-6">
          {/** Quick setup (manifest POST) */}
          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <GitBranch size={20} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{t('quick.title')}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{t('quick.subtitle')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const origin = window.location.origin
                const redirect = origin + '/api/v1/github/install/callback'
                const manifest = JSON.stringify({
                  name: '027apps Inspiration',
                  url: origin,
                  redirect_url: redirect,
                  callback_urls: [redirect],
                  hook_attributes: {
                    url: origin + '/api/v1/github/webhook',
                    active: true,
                  },
                  default_events: ['issues', 'issue_comment'],
                  default_permissions: { issues: 'write', metadata: 'read' },
                })
                const form = document.createElement('form')
                form.method = 'post'
                form.action = 'https://github.com/settings/apps/new'
                const input = document.createElement('input')
                input.type = 'hidden'
                input.name = 'manifest'
                input.value = manifest
                form.appendChild(input)
                document.body.appendChild(form)
                form.submit()
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
            >
              {t('quick.connect')}
            </button>
            <p className="text-xs text-gray-400 mt-2">{t('quick.hint')}</p>
          </div>

          {/** Manual setup form */}
          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-50">
              <GitBranch size={20} className="text-gray-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{t('manual.title')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{t('manual.subtitle')}</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700 space-y-2">
            <p className="font-medium">{t('manual.instructions_title')}</p>
            <ol className="list-decimal ml-4 space-y-1 text-xs">
              <li>{t('manual.step1')}</li>
              <li>{t('manual.step2')}</li>
              <li>{t('manual.step3')}</li>
              <li>{t('manual.step4')}</li>
              <li>{t('manual.step5')}</li>
            </ol>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('manual.app_id')}</label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="e.g. 123456"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('manual.private_key')}</label>
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
                rows={5}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('manual.installation_id')}</label>
              <input
                type="text"
                value={installationId}
                onChange={(e) => setInstallationId(e.target.value)}
                placeholder="e.g. 987654"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
              />
            </div>
            <button
              type="button"
              onClick={handleManualSave}
              disabled={isSaving || !appId || !privateKey || !installationId}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
              {t('manual.connect')}
            </button>
          </div>

          {/* Webhook secret */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('manual.webhook_secret')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="Optional: webhook secret"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
                />
                <button
                  type="button"
                  onClick={handleSaveWebhook}
                  disabled={!webhookSecret}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {t('manual.save_secret')}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('manual.webhook_hint')}</p>
            </div>
          </div>
        </div>
        </div>
      ) : (
        <>
          {/* Status card */}
          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <GitBranch size={20} className="text-green-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{t('connection.title')}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{t('connection.connected')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isTesting ? <Loader2 size={12} className="animate-spin" /> : null}
                  {t('connection.test')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <Link2Off size={12} />
                  {t('connection.disconnect')}
                </button>
              </div>
            </div>

            {testResult && (
              <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {testResult.ok ? <Check size={12} /> : <AlertCircle size={12} />}
                {testResult.ok ? t('connection.test_ok') : (testResult.error ?? t('connection.test_fail'))}
              </div>
            )}

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

          {/* Toggle */}
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
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.syncEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {settings.syncEnabled ? t('toggle.on_note') : t('toggle.off_note')}
            </p>
          </div>

          {/* Label mapping */}
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
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#' + (label?.color ?? 'ccc') }} />
                    <span className="text-xs font-mono text-gray-500 w-28">{type}</span>
                    <span className="text-gray-700">{label?.name ?? '—'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Label editor modal */}
      {showLabelEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowLabelEditor(false)} />
          <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">{t('labels.editor.title')}</h3>
              <button type="button" onClick={() => setShowLabelEditor(false)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"><X size={16} /></button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {TYPE_KEYS.map((type) => {
                const label = labelMap[type] ?? { name: '', color: '000000' }
                return (
                  <div key={type} className="text-sm">
                    <p className="text-xs font-medium text-gray-500 mb-1">{type}</p>
                    <div className="flex gap-2">
                      <input type="text" value={label.name} onChange={(e) => handleLabelChange(type, 'name', e.target.value)} placeholder="Label name" className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300" />
                      <div className="relative">
                        <input type="text" value={label.color} onChange={(e) => handleLabelChange(type, 'color', e.target.value.replace('#', ''))} placeholder="color" maxLength={6} className="w-16 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: '#' + label.color }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowLabelEditor(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">{t('labels.editor.cancel')}</button>
              <button type="button" onClick={handleSaveLabels} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">{t('labels.editor.save')}</button>
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
              <button type="button" onClick={() => setShowRepoEditor(false)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"><X size={16} /></button>
            </div>
            <input type="text" value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="owner/repo" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 mb-3" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowRepoEditor(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">{t('repo_editor.cancel')}</button>
              <button type="button" onClick={handleUpdateRepo} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">{t('repo_editor.save')}</button>
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
              <button type="button" onClick={() => setShowDisconnectConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">{t('disconnect_confirm.cancel')}</button>
              <button type="button" onClick={handleDisconnect} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer">{t('disconnect_confirm.confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
