'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { DsModal } from '@/components/ds/modal'
import { DsInput } from '@/components/ds/input'
import type { SmtpConfig } from '@/lib/settings/notifications'

export function NotificationSettingsForm({
  initialEmailEnabled,
  initialPushEnabled,
  initialSmtp,
}: {
  initialEmailEnabled: boolean
  initialPushEnabled: boolean
  initialSmtp: SmtpConfig | null
}) {
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled)
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled)
  const [showSmtpModal, setShowSmtpModal] = useState(false)
  const [pending, startTransition] = useTransition()

  // SMTP form state
  const [smtpHost, setSmtpHost] = useState(initialSmtp?.host ?? '')
  const [smtpPort, setSmtpPort] = useState(String(initialSmtp?.port ?? 587))
  const [smtpUser, setSmtpUser] = useState(initialSmtp?.user ?? '')
  const [smtpPass, setSmtpPass] = useState(initialSmtp?.pass ?? '')
  const [smtpFromEmail, setSmtpFromEmail] = useState(initialSmtp?.from_email ?? '')
  const [smtpFromName, setSmtpFromName] = useState(initialSmtp?.from_name ?? '')
  const [testing, setTesting] = useState(false)

  async function handleToggle(field: 'email' | 'push', value: boolean) {
    if (field === 'email') {
      if (value && !initialSmtp) {
        // Needs SMTP config before enabling
        setEmailEnabled(true)
        setShowSmtpModal(true)
        return
      }
      setEmailEnabled(value)
    } else {
      setPushEnabled(value)
    }

    startTransition(async () => {
      const res = await fetch('/api/v1/admin/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_enabled: field === 'email' ? value : emailEnabled,
          push_enabled: field === 'push' ? value : pushEnabled,
        }),
      })
      if (res.ok) toast.success('Updated')
      else { const d = await res.json(); toast.error(d.message || 'Failed') }
    })
  }

  async function handleSaveSmtp() {
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFromEmail) {
      toast.error('All SMTP fields are required')
      return
    }

    startTransition(async () => {
      const res = await fetch('/api/v1/admin/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_enabled: true,
          smtp: {
            host: smtpHost,
            port: parseInt(smtpPort, 10),
            user: smtpUser,
            pass: smtpPass,
            from_email: smtpFromEmail,
            from_name: smtpFromName,
          },
        }),
      })
      if (res.ok) {
        toast.success('SMTP configuration saved')
        setShowSmtpModal(false)
        setEmailEnabled(true)
      } else {
        const d = await res.json()
        toast.error(d.message || 'Failed to save')
      }
    })
  }

  async function handleTestSmtp() {
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFromEmail) {
      toast.error('Fill all SMTP fields first')
      return
    }

    setTesting(true)
    const res = await fetch('/api/v1/admin/settings/notifications/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: smtpHost, port: parseInt(smtpPort, 10), user: smtpUser, pass: smtpPass, from_email: smtpFromEmail }),
    })
    setTesting(false)

    if (res.ok) toast.success('SMTP connection successful!')
    else { const d = await res.json(); toast.error(d.message || 'Connection failed') }
  }

  return (
    <div className="space-y-8">
      {/* Push toggle */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Push Notifications</h2>
            <p className="text-xs text-slate-400 mt-0.5">Send push notifications to mobile devices via Expo</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={pushEnabled} onChange={(e) => handleToggle('push', e.target.checked)} disabled={pending} />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#9B1C1C]" />
          </label>
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          When disabled, no push notifications will be sent to any user regardless of their individual preferences.
        </p>
      </div>

      {/* Email toggle */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Email Notifications</h2>
            <p className="text-xs text-slate-400 mt-0.5">Send email notifications via SMTP or Resend</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={emailEnabled} onChange={(e) => handleToggle('email', e.target.checked)} disabled={pending} />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#9B1C1C]" />
          </label>
        </div>

        {/* Read-only SMTP config when enabled */}
        {emailEnabled && initialSmtp && (
          <div className="bg-slate-50 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SMTP Configuration</span>
              <button
                onClick={() => {
                  setSmtpHost(initialSmtp.host)
                  setSmtpPort(String(initialSmtp.port))
                  setSmtpUser(initialSmtp.user)
                  setSmtpPass(initialSmtp.pass)
                  setSmtpFromEmail(initialSmtp.from_email)
                  setSmtpFromName(initialSmtp.from_name)
                  setShowSmtpModal(true)
                }}
                className="text-xs font-medium text-red-800 hover:text-red-900"
              >
                Edit
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-slate-400">Host:</span><span className="text-slate-700 font-mono">{initialSmtp.host}:{initialSmtp.port}</span>
              <span className="text-slate-400">User:</span><span className="text-slate-700 font-mono">{initialSmtp.user}</span>
              <span className="text-slate-400">From:</span><span className="text-slate-700">{initialSmtp.from_name ? `${initialSmtp.from_name} <${initialSmtp.from_email}>` : initialSmtp.from_email}</span>
            </div>
          </div>
        )}

        {/* No SMTP warning */}
        {emailEnabled && !initialSmtp && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
            No SMTP server configured. Emails will be sent via the default provider (Resend).
            <button
              onClick={() => { setEmailEnabled(true); setShowSmtpModal(true) }}
              className="block mt-1 font-medium text-amber-900 underline"
            >
              Configure SMTP
            </button>
          </div>
        )}

        <p className="text-[11px] text-slate-400 mt-3">
          When disabled, no email notifications will be sent.
        </p>
      </div>

      {/* SMTP Config Modal */}
      <DsModal
        open={showSmtpModal}
        onClose={() => setShowSmtpModal(false)}
        title="SMTP Configuration"
        maxWidth={520}
      >
        <div className="space-y-3 mb-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <DsInput label="Host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" />
            </div>
            <div>
              <DsInput label="Port" type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
            </div>
          </div>
          <DsInput label="Username" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="user@example.com" />
          <DsInput label="Password" type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••" />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <DsInput label="From email" type="email" value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)} placeholder="notifications@example.com" />
            </div>
            <div>
              <DsInput label="From name" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} placeholder="027Apps" />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleTestSmtp}
            disabled={testing}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test connection'}
          </button>
          <button
            onClick={() => setShowSmtpModal(false)}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSmtp}
            disabled={pending}
            className="ml-auto px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </DsModal>
    </div>
  )
}
