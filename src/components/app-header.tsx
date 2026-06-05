import Link from 'next/link'
import { LocaleSwitcher } from './locale-switcher'
import { UserDropdown } from './user-dropdown'
import { GroupSwitcher } from './group-switcher'
import { GroupInfoButton } from './group-info-button'
import { getGroupSettings } from '@/lib/use-cases/settings'

interface GroupInfo {
  id: string
  name: string
  slug: string
  role: string
  memberCount?: number
}

interface MemberInfo {
  displayName: string
  role: string
}

interface AppInfo {
  slug: string
  name: string
}

interface Props {
  locale: string
  displayName: string
  isAdmin: boolean
  userGroups?: GroupInfo[]
  currentGroupSlug?: string | null
  groupMembers?: MemberInfo[]
  groupApps?: AppInfo[]
}

export async function AppHeader({ locale, displayName, isAdmin, userGroups, currentGroupSlug, groupMembers, groupApps }: Props) {
  const settings = await getGroupSettings()

  const homeHref = currentGroupSlug
    ? `/${locale}/${currentGroupSlug}/dashboard`
    : `/${locale}/`

  const currentGroup = userGroups?.find(g => g.slug === currentGroupSlug)
  const showGroupInfo = currentGroup && groupMembers && groupApps

  return (
    <header className="h-14 border-b border-slate-100 bg-white px-4 sm:px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <Link href={homeHref} className="flex items-center gap-2 flex-shrink-0">
          <img src="/logo-icon.svg" alt="027Apps" width={26} height={26} />
          <span className="font-semibold text-slate-900 text-sm hidden sm:inline">027Apps</span>
        </Link>

        {userGroups && userGroups.length > 0 && (
          <GroupSwitcher
            locale={locale}
            groups={userGroups}
            currentGroupSlug={currentGroupSlug}
            isAdmin={isAdmin}
          />
        )}

      </div>

      <div className="flex items-center gap-3">
        {showGroupInfo && (
          <GroupInfoButton
            groupName={currentGroup.name}
            groupSlug={currentGroup.slug}
            members={groupMembers}
            apps={groupApps}
          />
        )}
        <LocaleSwitcher currentLocale={locale} locales={settings.activeLocales} saveToDb />
        <UserDropdown locale={locale} displayName={displayName} isAdmin={isAdmin} />
      </div>
    </header>
  )
}
