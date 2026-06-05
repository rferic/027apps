import { promises as fs } from 'fs'
import path from 'path'
import { cachedQuery } from '@/lib/cache'
import type { AppManifest } from '@/types/apps'
import { AppValidationError } from '@/types/apps'

const SLUG_RE = /^[a-z0-9-]+$/
const TABLE_PREFIX_RE = /^[a-z][a-z0-9_]*_$/

function appsDir(): string {
  return path.join(process.cwd(), 'apps')
}

function appPath(slug: string, ...parts: string[]): string {
  if (!SLUG_RE.test(slug)) throw new AppValidationError(`Invalid slug: ${slug}`)
  return path.join(appsDir(), slug, ...parts)
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

function assertManifest(raw: unknown, slug: string): asserts raw is AppManifest {
  if (typeof raw !== 'object' || raw === null) throw new AppValidationError(`${slug}: manifest.json is not an object`)
  const m = raw as Record<string, unknown>
  const required = ['slug', 'name', 'version', 'description', 'primaryColor', 'secondaryColor', 'minPlatformVersion']
  for (const field of required) {
    if (typeof m[field] !== 'string' || !m[field]) throw new AppValidationError(`${slug}: missing or empty field "${field}"`)
  }
  const tablePrefix = m['tablePrefix']
  if (typeof tablePrefix !== 'string' || !tablePrefix) {
    throw new AppValidationError(`${slug}: missing or empty field "tablePrefix"`)
  }
  if (!TABLE_PREFIX_RE.test(tablePrefix) || tablePrefix.length > 20) {
    throw new AppValidationError(`${slug}: "tablePrefix" must match ^[a-z][a-z0-9_]*_$ and be max 20 chars (got "${tablePrefix}")`)
  }
  if (typeof m.author !== 'object' || m.author === null || typeof (m.author as Record<string, unknown>).name !== 'string') {
    throw new AppValidationError(`${slug}: "author.name" must be a string`)
  }
  if (typeof m.views !== 'object' || m.views === null) throw new AppValidationError(`${slug}: "views" must be an object`)
  const views = m.views as Record<string, unknown>
  for (const v of ['public', 'admin', 'widget', 'native']) {
    if (typeof views[v] !== 'boolean') throw new AppValidationError(`${slug}: "views.${v}" must be a boolean`)
  }
  if (typeof m.api !== 'boolean') throw new AppValidationError(`${slug}: "api" must be a boolean`)
  if (typeof m.notifications !== 'boolean') throw new AppValidationError(`${slug}: "notifications" must be a boolean`)
  if (!Array.isArray(m.dependencies)) throw new AppValidationError(`${slug}: "dependencies" must be an array`)
  if (!Array.isArray(m.config)) throw new AppValidationError(`${slug}: "config" must be an array`)
  for (const field of m.config as unknown[]) {
    if (typeof field !== 'object' || field === null) throw new AppValidationError(`${slug}: config entry must be an object`)
    const f = field as Record<string, unknown>
    if (!['string', 'number', 'boolean', 'select', 'textarea'].includes(f.type as string)) {
      throw new AppValidationError(`${slug}: config field "${f.key}" has invalid type "${f.type}"`)
    }
    if (f.type === 'select' && (!Array.isArray(f.options) || (f.options as unknown[]).length === 0)) {
      throw new AppValidationError(`${slug}: config field "${f.key}" of type "select" must have at least one option`)
    }
  }
}

export const readManifest = cachedQuery(
  async (slug: string): Promise<AppManifest> => {
    if (!SLUG_RE.test(slug)) throw new AppValidationError(`Invalid slug: ${slug}`)

    const manifestPath = appPath(slug, 'manifest.json')
    let raw: unknown
    try {
      const content = await fs.readFile(manifestPath, 'utf-8')
      raw = JSON.parse(content)
    } catch {
      throw new AppValidationError(`${slug}: could not read manifest.json`)
    }

    assertManifest(raw, slug)
    const manifest = raw as AppManifest

    const viewFiles: Array<[boolean, string]> = [
      [manifest.views.public, 'view.tsx'],
      [manifest.views.admin, 'admin.tsx'],
      [manifest.views.widget, 'widget.tsx'],
      [manifest.views.native, 'native.tsx'],
    ]
    for (const [required, file] of viewFiles) {
      if (required && !(await fileExists(appPath(slug, file)))) {
        throw new AppValidationError(`${slug}: declared views.${file.replace('.tsx', '')} but "${file}" not found`)
      }
    }

    if (manifest.api) {
      const routesDir = appPath(slug, 'routes')
      if (!(await fileExists(routesDir))) {
        throw new AppValidationError(`${slug}: api=true but "routes/" directory not found`)
      }
    }

    const hasMigrations = await fileExists(appPath(slug, 'migrations.sql'))
    const hasUninstall = await fileExists(appPath(slug, 'uninstall.sql'))
    if (hasMigrations && !hasUninstall) throw new AppValidationError(`${slug}: has migrations.sql but missing uninstall.sql`)
    if (hasUninstall && !hasMigrations) throw new AppValidationError(`${slug}: has uninstall.sql but missing migrations.sql`)

    const docsDir = appPath(slug, 'docs')
    if (await fileExists(docsDir)) {
      if (!(await fileExists(appPath(slug, 'docs', 'index.mdx')))) {
        throw new AppValidationError(`${slug}: has docs/ directory but missing docs/index.mdx`)
      }
    }

    // guard against path traversal
    if (manifest.logo) {
      const logoResolved = path.join(appsDir(), slug, manifest.logo)
      const appBase = path.join(appsDir(), slug) + path.sep
      if (!logoResolved.startsWith(appBase)) {
        throw new AppValidationError(`${slug}: logo path "${manifest.logo}" escapes app directory`)
      }
      if (!(await fileExists(logoResolved))) {
        throw new AppValidationError(`${slug}: logo file "${manifest.logo}" not found`)
      }
    }

    // Auto-add extends to dependencies so dependency resolution is consistent
    if (manifest.extends && !manifest.dependencies.includes(manifest.extends)) {
      manifest.dependencies = [...manifest.dependencies, manifest.extends]
    }

    if (manifest.i18n === true) {
      if (!(await fileExists(appPath(slug, 'i18n', 'en.json')))) {
        throw new AppValidationError(`${slug}: i18n=true but "i18n/en.json" not found`)
      }
    }

    return manifest
  },
  ['manifest'],
  { revalidate: 604800, tags: ['manifest'] }
)
