import type { AppInstallContext } from '@/types/apps'

export async function uninstall(_ctx: AppInstallContext): Promise<void> {
  // Data is cleaned up via CASCADE when tables are dropped in uninstall.sql
}
