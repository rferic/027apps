import Link from 'next/link'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { getAdminStats, getAdminUserList } from '@/lib/use-cases/admin/users'
import { getAdminInvitationList, getInvitationStatus } from '@/lib/use-cases/invitations'
import { getInspirationAdminStats } from '@/lib/use-cases/inspiration/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { DsCard } from '@/components/ds/card'
import { DsBadge } from '@/components/ds/badge'
import { DsAvatar } from '@/components/ds/avatar'
import HotIdeasList from './HotIdeasList'
import SplitExpensesDashboardWidget from '../../../../../../apps/split-expenses/dashboard-widget'

interface Props {
  params: Promise<{ locale: string }>
}

function AdminStatCard({ label, value, href, sublabel }: { label: string; value: number; href?: string; sublabel?: string }) {
  const inner = (
    <DsCard padding="md" hover={!!href}>
      <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)', margin: '4px 0 0' }}>{value}</p>
      {sublabel && <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>{sublabel}</p>}
    </DsCard>
  )
  if (href) return <Link href={href} style={{ display: 'block', textDecoration: 'none' }}>{inner}</Link>
  return inner
}

export default async function AdminDashboard({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin.dashboard')
  const base = `/${locale}/admin`

  const adminClient = createAdminClient()
  const { data: inspirationInstalled } = await adminClient
    .from('installed_apps')
    .select('slug')
    .eq('slug', 'inspiration')
    .eq('status', 'active')
    .single()

  const { data: splitExpensesInstalled } = await adminClient
    .from('installed_apps')
    .select('slug')
    .eq('slug', 'split-expenses')
    .eq('status', 'active')
    .single()
  const isInspirationInstalled = !!inspirationInstalled

  const [stats, users, invitations, inspirationStats] = await Promise.all([
    getAdminStats(),
    getAdminUserList(),
    getAdminInvitationList(),
    isInspirationInstalled ? getInspirationAdminStats() : Promise.resolve(null),
  ])
  const recentInvitations = invitations.slice(0, 5)

  return (
    <main style={{ padding: 24, maxWidth: 1024, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{t('title')}</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>{t('subtitle')}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
        <AdminStatCard label={t('statsPending')} value={stats.pendingInvitations} href={`${base}/invitations`} />
        <AdminStatCard label={t('statsGroups')} value={stats.totalGroups} href={`${base}/groups`} />
        <AdminStatCard label={t('statsMembers')} value={stats.members} href={`${base}/users`} />
        <AdminStatCard label={t('statsAdmins')} value={stats.admins} href={`${base}/admins`} />
        <AdminStatCard label={t('statsApps')} value={stats.installedApps} href={`${base}/apps`} sublabel={`${stats.totalApps} ${t('statsAppsSublabel')}`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <DsCard padding="md" hover={false}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{t('recentUsers')}</h2>
            <Link href={`${base}/users`} style={{ fontSize: 12, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>{t('viewAll')}</Link>
          </div>
          {users.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{t('noUsers')}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {users.slice(0, 5).map((user) => (
                <li key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DsAvatar size={28} color="var(--color-muted)">{user.displayName.slice(0, 2).toUpperCase()}</DsAvatar>
                    <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{user.displayName}</span>
                  </div>
                  <DsBadge variant={user.role === 'admin' ? 'primary' : 'neutral'}>{user.role}</DsBadge>
                </li>
              ))}
            </ul>
          )}
        </DsCard>

        <DsCard padding="md" hover={false}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{t('recentInvitations')}</h2>
            <Link href={`${base}/invitations`} style={{ fontSize: 12, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>{t('viewAll')}</Link>
          </div>
          {recentInvitations.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{t('noInvitations')}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentInvitations.map((inv) => {
                const status = getInvitationStatus(inv)
                const statusVariant: Record<string, 'success' | 'neutral' | 'warning' | 'error'> = { pending: 'success', accepted: 'neutral', expired: 'warning', revoked: 'error' }
                return (
                  <li key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{inv.title}</span>
                    <DsBadge variant={statusVariant[status] || 'neutral'}>{status}</DsBadge>
                  </li>
                )
              })}
            </ul>
          )}
          <Link href={`${base}/invitations`} style={{
            marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '10px', fontSize: 12, fontWeight: 600, background: 'var(--color-text)', color: 'var(--color-bg)',
            borderRadius: 'var(--radius-lg)', textDecoration: 'none',
          }}>{t('newInvitation')}</Link>
        </DsCard>
      </div>

      {/* Inspiration */}
      {inspirationStats && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 20, height: 20, borderRadius: 4, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5C7.6 12.3 8.3 13.3 8.5 14.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
            </div>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{t('inspiration_title')}</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            <AdminStatCard label={t('total_ideas')} value={inspirationStats.totalRequests} />
            <AdminStatCard label={t('pending')} value={inspirationStats.pending} />
            <AdminStatCard label={t('reviewing')} value={inspirationStats.reviewing} />
            <AdminStatCard label={t('completed')} value={inspirationStats.completed} />
          </div>
          {inspirationStats.hotIdeas.length > 0 && (
            <DsCard padding="md" hover={false}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{t('most_supported')}</h3>
                <Link href={`/${locale}/admin/apps/inspiration`} style={{ fontSize: 12, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>{t('viewAll')}</Link>
              </div>
              <HotIdeasList ideas={inspirationStats.hotIdeas} />
            </DsCard>
          )}
        </div>
      )}

      {/* Split Expenses Widget */}
      {splitExpensesInstalled && (
        <div style={{ marginTop: 32 }}>
          <SplitExpensesDashboardWidget />
        </div>
      )}
    </main>
  )
}
