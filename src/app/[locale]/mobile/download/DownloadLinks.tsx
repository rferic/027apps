'use client'

interface VersionInfo {
  latest_version: string
  min_version: string
  download_url: string
  release_notes: string | null
}

function DownloadCard({ label, version }: { label: string; version: VersionInfo }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 w-full">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
          label === 'Beta' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
        }`}>
          {label}
        </span>
        <span className="font-mono text-sm text-slate-900">{version.latest_version}</span>
      </div>

      {version.release_notes && (
        <p className="text-xs text-slate-500 mb-3 whitespace-pre-wrap">{version.release_notes}</p>
      )}

      {version.download_url ? (
        <a
          href={version.download_url}
          download
          className="inline-flex items-center justify-center w-full gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download APK
        </a>
      ) : (
        <p className="text-xs text-slate-400 text-center py-2">No version published yet</p>
      )}
    </div>
  )
}

export function DownloadLinks({ variants }: { variants: { label: string; version: VersionInfo }[] }) {
  if (variants.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400">No mobile versions available yet.</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      {variants.map((v) => (
        <DownloadCard key={v.label} label={v.label} version={v.version} />
      ))}
    </div>
  )
}
