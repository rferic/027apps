import type { AppInstallContext } from '@/types/apps'

export async function install(_ctx: AppInstallContext): Promise<void> {
  // No seed data needed — requests are created by users
}
