import type { AppInstallContext } from '@/types/apps'

export async function uninstall(_ctx: AppInstallContext): Promise<void> {
  // Cleanup handled by uninstall.sql (DROP TABLE ... CASCADE)
}
