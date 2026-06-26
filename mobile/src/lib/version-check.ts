import { getApiClient } from './api'

interface VersionInfo {
  latest_version: string
  min_version: string
  download_url: string
  release_notes: string | null
}

export async function checkAppVersion(): Promise<VersionInfo | null> {
  try {
    const client = await getApiClient()
    const response = await client.version.getVersion({})
    if (response.status === 200) return response.body
    return null
  } catch {
    return null
  }
}

export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (partsA[i] > partsB[i]) return 1
    if (partsA[i] < partsB[i]) return -1
  }
  return 0
}

export function isUpdateRequired(currentVersion: string, minVersion: string): boolean {
  return compareVersions(currentVersion, minVersion) < 0
}

export function isUpdateAvailable(currentVersion: string, latestVersion: string): boolean {
  return compareVersions(currentVersion, latestVersion) < 0
}
