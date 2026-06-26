'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Drawer } from '@base-ui/react/drawer'
import { Dialog } from '@base-ui/react/dialog'
import { useMediaQuery } from '@base-ui/react/unstable-use-media-query'
import { GroupMembersSection } from './[id]/GroupMembersSection'
import { GroupAppsSection } from './[id]/GroupAppsSection'
import { getGroupDetailAction, type GroupDetailData } from './group-detail-actions'

interface Props {
  groupId: string
  groupName: string
  groupSlug: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  locale: string
}

export function GroupDetailDrawer({ groupId, groupName, groupSlug, isOpen, onOpenChange }: Props) {
  const t = useTranslations('admin')
  const isDesktop = useMediaQuery('(min-width: 768px)', { noSsr: true })
  const [data, setData] = useState<GroupDetailData | null>(null)
  const [error, setError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    getGroupDetailAction(groupId)
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [groupId, refreshKey])

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setData(null)
      onOpenChange(false)
    }
  }

  const content = (
    <div className="h-full overflow-auto">
      <div className="flex items-start justify-between p-6 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{groupName}</h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{groupSlug}</p>
        </div>
        {isDesktop ? (
          <Drawer.Close className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-muted-foreground hover:bg-muted cursor-pointer transition-colors">
            <X size={18} />
          </Drawer.Close>
        ) : (
          <Dialog.Close className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-muted-foreground hover:bg-muted cursor-pointer transition-colors">
            <X size={18} />
          </Dialog.Close>
        )}
      </div>

      <div className="px-6 pb-8 space-y-6">
        {!data && !error ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-500">Failed to load group details</p>
        ) : data ? (
          <>
            {/* Members section */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t('groups.members_section')}
              </h3>
              <GroupMembersSection groupId={groupId} members={data.members} onRefresh={() => setRefreshKey(k => k + 1)} />
            </section>

            {/* Apps section */}
            {data.apps.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {t('groups.apps_section')}
                </h3>
                <GroupAppsSection groupId={groupId} apps={data.apps} />
              </section>
            )}
            <div className="pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  if (!confirm(t('groups.delete_confirm_title', { name: groupName }))) return
                  import('./[id]/actions').then(m =>
                    m.deleteGroupAction(groupId).then(r => {
                      if (r.error) { toast.error(r.error) }
                      else { toast.success(t('groups.deleted')); onOpenChange(false) }
                    })
                  )
                }}
                className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
              >
                {t('groups.delete_group')}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <Drawer.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        modal
        swipeDirection="left"
      >
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 bg-black/40 z-40 transition-opacity data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Drawer.Viewport className="fixed z-50 top-0 right-0 h-full w-full max-w-lg">
            <Drawer.Popup className="bg-card shadow-2xl outline-none h-full transition-transform duration-300 data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full">
              <Drawer.Title className="sr-only">{t('groups.title')}: {groupName}</Drawer.Title>
              <Drawer.Description className="sr-only">
                {groupSlug}
              </Drawer.Description>
              {content}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40 transition-opacity data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-lg max-h-[85vh] bg-card rounded-xl shadow-xl outline-none transition-opacity data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 overflow-auto">
          <Dialog.Title className="sr-only">{t('groups.title')}: {groupName}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {groupSlug}
          </Dialog.Description>
          {content}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
