import * as SecureStore from 'expo-secure-store'

const GROUP_SLUG_KEY = '027apps_group_slug'

export async function getActiveGroupSlug(): Promise<string | null> {
  const slug = await SecureStore.getItemAsync(GROUP_SLUG_KEY)
  return slug || null
}

export async function setActiveGroupSlug(slug: string): Promise<void> {
  await SecureStore.setItemAsync(GROUP_SLUG_KEY, slug)
}
