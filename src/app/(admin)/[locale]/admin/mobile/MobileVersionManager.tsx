'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface MobileVersion {
  latest_version: string
  min_version: string
  download_url: string | null
  release_notes: string | null
  apk_path: string | null
}

interface Props {
  current: MobileVersion | null
}

export function MobileVersionManager({ current }: Props) {
  const [version, setVersion] = useState('')
  const [minVersion, setMinVersion] = useState('')
  const [setAsMin, setSetAsMin] = useState(false)
  const [releaseNotes, setReleaseNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, startUpload] = useTransition()

  async function handleUpload() {
    if (!version.trim() || !file) return

    const semverRegex = /^\d+\.\d+\.\d+$/
    if (!semverRegex.test(version.trim())) {
      toast.error('Version must be in semver format (e.g. 1.0.0)')
      return
    }

    const formData = new FormData()
    formData.append('version', version.trim())
    formData.append('min_version', setAsMin ? version.trim() : (minVersion.trim() || version.trim()))
    if (releaseNotes.trim()) formData.append('release_notes', releaseNotes.trim())
    formData.append('file', file)

    startUpload(async () => {
      try {
        const res = await fetch('/api/v1/admin/mobile/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()

        if (!res.ok) {
          toast.error(data.message || 'Upload failed')
          return
        }

        toast.success('Version uploaded successfully')
        // Reset form
        setVersion('')
        setMinVersion('')
        setSetAsMin(false)
        setReleaseNotes('')
        setFile(null)
        // Reload to show updated version
        window.location.reload()
      } catch {
        toast.error('Upload failed')
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Current Version */}
      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Current Version</h2>
        {current ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Latest version</span>
              <p className="font-mono text-slate-900">{current.latest_version}</p>
            </div>
            <div>
              <span className="text-slate-400">Minimum version</span>
              <p className="font-mono text-slate-900">{current.min_version}</p>
            </div>
            {current.release_notes && (
              <div className="col-span-2">
                <span className="text-slate-400">Release notes</span>
                <p className="text-slate-700 whitespace-pre-wrap">{current.release_notes}</p>
              </div>
            )}
            {current.download_url && (
              <div className="col-span-2">
                <span className="text-slate-400">Download URL</span>
                <p className="font-mono text-xs text-slate-500 break-all">{current.download_url}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No version published yet. Upload the first version below.</p>
        )}
      </Card>

      {/* Upload Form */}
      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Upload New Version</h2>
        <div className="space-y-4 max-w-md">
          <div>
            <Label htmlFor="version">Version (semver)</Label>
            <Input
              id="version"
              type="text"
              placeholder="1.0.1"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={setAsMin}
              onChange={(e) => setSetAsMin(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-600">Set as minimum required version</span>
          </label>

          {!setAsMin && (
            <div>
              <Label htmlFor="minVersion">Minimum version (optional)</Label>
              <Input
                id="minVersion"
                type="text"
                placeholder="1.0.0"
                value={minVersion}
                onChange={(e) => setMinVersion(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="releaseNotes">Release notes</Label>
            <textarea
              id="releaseNotes"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white resize-y"
              placeholder="What's new in this version..."
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="apkFile">APK file (.apk)</Label>
            <input
              id="apkFile"
              type="file"
              accept=".apk"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
            />
            {file && <p className="text-xs text-slate-400 mt-1">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>}
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploading || !version.trim() || !file}
            className="bg-slate-900 hover:bg-slate-700 text-white"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
