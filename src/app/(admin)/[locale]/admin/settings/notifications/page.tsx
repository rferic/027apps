import { setRequestLocale } from 'next-intl/server'
import { getNotificationsConfig } from '@/lib/settings/notifications'
import { NotificationSettingsForm } from './NotificationSettingsForm'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function NotificationSettingsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const config = await getNotificationsConfig()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground">Notification Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Globally enable or disable email and push notifications
        </p>
      </div>

      <NotificationSettingsForm
        initialEmailEnabled={config.email_enabled}
        initialPushEnabled={config.push_enabled}
        initialSmtp={config.smtp}
      />
    </div>
  )
}
