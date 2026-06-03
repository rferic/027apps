'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface Props {
  manageContent: React.ReactNode
  settingsContent: React.ReactNode
  manageLabel: string
  settingsLabel: string
  defaultValue?: string
}

export function AdminAppTabs({
  manageContent,
  settingsContent,
  manageLabel,
  settingsLabel,
  defaultValue = 'manage',
}: Props) {
  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList variant="line" className="mb-4">
        <TabsTrigger value="manage">{manageLabel}</TabsTrigger>
        <TabsTrigger value="settings">{settingsLabel}</TabsTrigger>
      </TabsList>
      <TabsContent value="manage" className="space-y-6">
        {manageContent}
      </TabsContent>
      <TabsContent value="settings" className="space-y-6">
        {settingsContent}
      </TabsContent>
    </Tabs>
  )
}
