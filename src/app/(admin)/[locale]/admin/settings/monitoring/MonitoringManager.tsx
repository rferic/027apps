'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { testConnectionAction, saveProviderConfigAction, disconnectProviderAction } from './actions'
import type { ProviderDefinition } from '@/lib/monitoring'

interface Props {
  definitions: ProviderDefinition[]
  initialConfigs: Record<string, Record<string, string>>
}

export function MonitoringManager({ definitions, initialConfigs }: Props) {
  const t = useTranslations('admin.settings.monitoring')
  const [configs, setConfigs] = useState(initialConfigs)
  const [testing, setTesting] = useState<string | null>(null)

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
                    <h2 className="text-sm font-semibold text-slate-900">{def.name}</h2>
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
      </div>
    </div>
  )
}
