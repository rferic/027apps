import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createApiAdminClient } from '@/lib/supabase/api'

async function uploadToStorage(
  fileName: string,
  fileBuffer: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const admin = createApiAdminClient()
  const { error } = await admin.storage
    .from('apk-releases')
    .upload(fileName, fileBuffer, {
      contentType,
      upsert: true,
    })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return fileName
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError('BAD_REQUEST', 'Invalid form data', 400)
  }

  const version = formData.get('version')
  const minVersion = formData.get('min_version')
  const releaseNotes = formData.get('release_notes')
  const file = formData.get('file')

  if (!version || typeof version !== 'string') {
    return apiError('VALIDATION_ERROR', 'version is required', 400)
  }

  if (!file || !(file instanceof File)) {
    return apiError('VALIDATION_ERROR', 'APK file is required', 400)
  }

  if (!file.name.endsWith('.apk')) {
    return apiError('VALIDATION_ERROR', 'File must be an .apk', 400)
  }

  const semverRegex = /^\d+\.\d+\.\d+$/
  if (!semverRegex.test(version)) {
    return apiError('VALIDATION_ERROR', 'version must be in semver format (e.g. 1.0.0)', 400)
  }

  if (minVersion && typeof minVersion === 'string' && !semverRegex.test(minVersion)) {
    return apiError('VALIDATION_ERROR', 'min_version must be in semver format (e.g. 1.0.0)', 400)
  }

  const fileBuffer = await file.arrayBuffer()

  // Upload to Supabase Storage
  const fileName = `027apps-${version}.apk`
  let apkPath: string
  try {
    apkPath = await uploadToStorage(fileName, fileBuffer, file.type || 'application/vnd.android.package-archive')
  } catch (err) {
    return apiError('INTERNAL_ERROR', err instanceof Error ? err.message : 'Upload failed', 500)
  }

  // Build download URL
  const downloadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/apk-releases/${apkPath}`

  const effectiveMinVersion = typeof minVersion === 'string' && minVersion ? minVersion : version
  const notes = typeof releaseNotes === 'string' && releaseNotes.trim() ? releaseNotes.trim() : null

  const admin = createApiAdminClient()
  const { error: upsertError } = await admin
    .from('app_settings')
    .upsert({
      key: 'mobile_version',
      value: {
        latest_version: version,
        min_version: effectiveMinVersion,
        download_url: downloadUrl,
        release_notes: notes,
        apk_path: apkPath,
      },
      updated_at: new Date().toISOString(),
    })

  if (upsertError) {
    return apiError('INTERNAL_ERROR', 'Failed to save version settings', 500)
  }

  return apiOk({ success: true })
}
