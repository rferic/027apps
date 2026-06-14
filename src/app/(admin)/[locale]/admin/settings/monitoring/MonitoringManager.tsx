'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Info, X } from 'lucide-react'
import { testConnectionAction, saveProviderConfigAction, disconnectProviderAction } from './actions'
import type { ProviderDefinition } from '@/lib/monitoring'

interface Props {
  definitions: ProviderDefinition[]
  initialConfigs: Record<string, Record<string, string>>
}

const HELP_CONTENT: Record<string, { title: string; steps: (string | { text: string; url: string })[] }> = {
  vercel: {
    title: 'Obtener token de Vercel',
    steps: [
      { text: 'vercel.com/account/tokens', url: 'https://vercel.com/account/tokens' },
      'Inicia sesión con tu cuenta de Vercel',
      'Haz clic en "Create"',
      'Asigna un nombre (ej. "027apps monitoring")',
      'Selecciona el scope "Read" (solo lectura)',
      'Haz clic en "Create"',
      'Copia el token generado y pégalo en el campo de arriba',
    ],
  },
  supabase: {
    title: 'Obtener credenciales de Supabase',
    steps: [
      { text: 'supabase.com/dashboard/project/zbwvvzeljiymwqcbemyy/settings/api', url: 'https://supabase.com/dashboard/project/zbwvvzeljiymwqcbemyy/settings/api' },
      'Localiza "Project Reference" (en la sección General)',
      'Cópialo y pégalo en el campo "Project Reference"',
      'Localiza "service_role key" (en la sección Project API keys)',
      'Cópiala y pégala en el campo "Service Role Key"',
      'Haz clic en "Test connection" para verificar',
    ],
  },
}

function HelpModal({ providerId, onClose }: { providerId: string; onClose: () => void }) {
  const content = HELP_CONTENT[providerId]
  if (!content) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">{content.title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <ol className="space-y-3">
          {content.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-600">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {typeof step === 'string' ? (
                <span>{step}</span>
              ) : (
                <a
                  href={step.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
                >
                  {step.text}
                </a>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export function MonitoringManager({ definitions, initialConfigs }: Props) {
  const t = useTranslations('admin.settings.monitoring')
  const [configs, setConfigs] = useState(initialConfigs)
  const [testing, setTesting] = useState<string | null>(null)
  const [helpProvider, setHelpProvider] = useState<string | null>(null)

  const handleConfigChange = useCallback((providerId: string, key: string, value: string) => {
    setConfigs(prev => ({
      ...prev,
      [providerId]: { ...(prev[providerId] ?? {}), [key]: value },
    }))
  }, [])

  const handleTest = useCallback(async (def: ProviderDefinition) => {
    setTesting(def.id)
    try {
      const result = await testConnectionAction(def.id, configs[def.id] ?? {})
      if (result.ok) {
        toast.success(`${def.name}: ${t('connected')}`)
      } else {
        toast.error(`${def.name}: ${result.error ?? t('connection_failed')}`)
      }
    } catch {
      toast.error(t('connection_failed'))
    } finally {
      setTesting(null)
    }
  }, [configs, t])

  const handleSave = useCallback(async (def: ProviderDefinition) => {
    const result = await saveProviderConfigAction(def.id, configs[def.id] ?? {})
    if (result.ok) {
      toast.success(`${def.name}: ${t('saved')}`)
    } else {
      toast.error(result.error ?? t('save_failed'))
    }
  }, [configs, t])

  const handleDisconnect = useCallback(async (def: ProviderDefinition) => {
    if (!confirm(t('disconnect_confirm', { name: def.name }))) return
    await disconnectProviderAction(def.id)
    const cleared: Record<string, string> = {}
    def.fields.forEach(f => { cleared[f.key] = '' })
    setConfigs(prev => ({ ...prev, [def.id]: cleared }))
    toast.success(`${def.name}: ${t('disconnected')}`)
  }, [t])

  return (
    <div className="space-y-6">
      {definitions.map(def => {
        const cfg = configs[def.id] ?? {}
        const hasConfig = def.fields.some(f => cfg[f.key])
        const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white'

        return (
          <div key={def.id} className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">{def.icon}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-semibold text-slate-900">{def.name}</h2>
                    <button
                      type="button"
                      onClick={() => setHelpProvider(def.id)}
                      className="p-0.5 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                      title="Cómo configurar"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">{def.description}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${hasConfig ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                {hasConfig ? t('status_connected') : t('status_disconnected')}
              </span>
            </div>

            <div className="space-y-3">
              {def.fields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={cfg[field.key] ?? ''}
                    onChange={e => handleConfigChange(def.id, field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTest(def)}
                disabled={testing === def.id}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {testing === def.id ? t('testing') : t('test')}
              </button>
              <button
                type="button"
                onClick={() => handleSave(def)}
                className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                {t('save')}
              </button>
              {hasConfig && (
                <button
                  type="button"
                  onClick={() => handleDisconnect(def)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                >
                  {t('disconnect')}
                </button>
              )}
            </div>
          </div>
        )
      })}

      {helpProvider && <HelpModal providerId={helpProvider} onClose={() => setHelpProvider(null)} />}
    </div>
  )
}
