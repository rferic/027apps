'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Invitation } from '@/lib/use-cases/invitations'
import { InvitationTable } from './InvitationTable'
import { CreateInvitationModal } from './CreateInvitationModal'

interface Props {
  invitations: Invitation[]
  baseUrl: string
  availableGroups: { id: string; name: string; slug: string }[]
}

export function InvitationsManager({ invitations, baseUrl, availableGroups }: Props) {
  const t = useTranslations('admin.invitations')
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {invitations.length === 1
              ? t('subtitle', { count: invitations.length })
              : t('subtitlePlural', { count: invitations.length })}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="cursor-pointer px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          {t('new')}
        </button>
      </div>

      <InvitationTable invitations={invitations} baseUrl={baseUrl} />

      {showCreateModal && (
        <CreateInvitationModal
          baseUrl={baseUrl}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => setShowCreateModal(false)}
          availableGroups={availableGroups}
        />
      )}
    </main>
  )
}
