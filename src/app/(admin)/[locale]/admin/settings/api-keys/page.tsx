import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listApiKeys } from '@/lib/use-cases/api-keys/list-api-keys'
import { ApiKeysManager } from './ApiKeysManager'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function ApiKeysPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin.settings.api_keys')

  const admin = createAdminClient()
  const { data: group } = await admin.from('groups').select('id').limit(1).single()

  const keys = group ? await listApiKeys(group.id) : []

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
      </div>
      <ApiKeysManager initialKeys={keys} />
    </div>
  )
}
