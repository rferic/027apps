import { promises as fs } from 'fs'
import path from 'path'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AppInstallContext } from '@/types/apps'
import { readManifest } from '@/lib/apps/manifest'
import { scanApps } from '@/lib/apps/scanner'
import { hasAppModule, loadAppModule } from '@/lib/apps/registry'

type InstallModule = { install: (ctx: AppInstallContext) => Promise<void> }
type UninstallModule = { uninstall: (ctx: AppInstallContext) => Promise<void> }

function extractCreateTableNames(sql: string): string[] {
  const names: string[] = []
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["']?(\w+)["']?\s*\(/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(sql)) !== null) {
    names.push(match[1])
  }
  return names
}

export class InstallerError extends Error {
  constructor(
    public readonly code: string,
    public readonly params: Record<string, string>,
    message: string
  ) {
    super(message)
    this.name = 'InstallerError'
  }
}

async function tryImportInstall(slug: string): Promise<InstallModule | null> {
  try {
    if (!hasAppModule(slug, 'install')) return null
    const install = await loadAppModule(slug, 'install')
    return { install: (ctx: AppInstallContext) => install(ctx) }
  } catch {
    return null
  }
}

async function tryImportUninstall(slug: string): Promise<UninstallModule | null> {
  try {
    if (!hasAppModule(slug, 'uninstall')) return null
    const uninstall = await loadAppModule(slug, 'uninstall')
    return { uninstall: (ctx: AppInstallContext) => uninstall(ctx) }
  } catch {
    return null
  }
}

export async function installApp(slug: string): Promise<void> {
  const adminClient = createAdminClient()

  const manifest = await readManifest(slug)

  if (manifest.dependencies.length > 0) {
    const { data: depRows, error: depError } = await adminClient
      .from('installed_apps')
      .select('slug, status')
      .in('slug', manifest.dependencies)
    if (depError) throw new Error(`Failed to check dependencies: ${depError.message}`)
    const activeSet = new Set((depRows ?? []).filter(r => r.status === 'active').map(r => r.slug))
    for (const dep of manifest.dependencies) {
      if (!activeSet.has(dep)) {
        throw new InstallerError('dependency_not_installed', { dep }, `Dependency "${dep}" is not installed or not active`)
      }
    }
  }

  if (manifest.extends) {
    const baseManifest = await readManifest(manifest.extends)
    const basePoints = baseManifest.extensionPoints ?? []
    const declaredPoints = manifest.extensionPoints ?? []
    for (const point of declaredPoints) {
      if (!basePoints.includes(point)) {
        throw new InstallerError(
          'extension_point_not_found',
          { base: manifest.extends!, point },
          `${slug}: extension point "${point}" is not declared by "${manifest.extends}"`
        )
      }
    }
  }

  const { data: activeApps, error: activeAppsError } = await adminClient
    .from('installed_apps')
    .select('slug')
    .eq('status', 'active')
  if (activeAppsError) throw new Error(`Failed to check prefix uniqueness: ${activeAppsError.message}`)
  for (const { slug: installedSlug } of (activeApps ?? [])) {
    if (installedSlug === slug) continue
    const installedManifest = await readManifest(installedSlug)
    if (installedManifest.tablePrefix === manifest.tablePrefix) {
      throw new InstallerError(
        'prefix_conflict',
        { prefix: manifest.tablePrefix, slug: installedSlug },
        `Table prefix "${manifest.tablePrefix}" is already used by app "${installedSlug}"`
      )
    }
  }

  const { error: insertError } = await adminClient.rpc('exec_sql', {
    sql: `insert into installed_apps (slug, version, status, config, table_prefix) values ('${slug}', '${manifest.version}', 'installing', '{}', '${manifest.tablePrefix}')`
  })
  if (insertError) throw new Error(`Failed to insert installed_app: ${insertError.message}`)

  const migrationsPath = path.join(process.cwd(), 'apps', slug, 'migrations.sql')
  let migrationSql: string | null = null
  try {
    migrationSql = await fs.readFile(migrationsPath, 'utf-8')
  } catch {
    // optional file
  }

  if (migrationSql) {
    const tableRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?["']?(\w+)["']?/gi
    let tableMatch: RegExpExecArray | null
    while ((tableMatch = tableRe.exec(migrationSql)) !== null) {
      const tableName = tableMatch[1].toLowerCase()
      if (!tableName.startsWith(manifest.tablePrefix)) {
        throw new InstallerError(
          'table_prefix_mismatch',
          { table: tableName, prefix: manifest.tablePrefix },
          `${slug}: table "${tableName}" in migrations.sql does not use the declared prefix "${manifest.tablePrefix}"`
        )
      }
    }

    const { error: sqlError } = await adminClient.rpc('exec_sql', { sql: migrationSql })
    if (sqlError) {
      await adminClient
        .from('installed_apps')
        .update({ status: 'error', error: sqlError.message })
        .eq('slug', slug)
      throw new Error(`Migrations failed for "${slug}": ${sqlError.message}`)
    }

    // Grant permissions on all app tables to service_role (needed for PostgREST)
    const grantSql = extractCreateTableNames(migrationSql)
      .map(t => `grant select, insert, update, delete on ${t} to service_role;`)
      .join('\n')
    if (grantSql) {
      const { error: grantError } = await adminClient.rpc('exec_sql', { sql: grantSql })
      if (grantError) {
        console.error(`[installer] grant failed for "${slug}": ${grantError.message}`)
      }
    }

    // Force PostgREST schema reload so it picks up the new tables
    try {
      await adminClient.rpc('exec_sql', { sql: "notify pgrst, 'reload schema';" })
    } catch (e) {
      console.error(`[installer] schema reload failed for "${slug}":`, e)
    }
  }

  const ctx: AppInstallContext = { supabase: adminClient, manifest, slug }
  const installMod = await tryImportInstall(slug)
  if (installMod) {
    try {
      await installMod.install(ctx)
    } catch (installErr) {
      const errMsg = installErr instanceof Error ? installErr.message : String(installErr)

      // Attempt rollback: uninstall.ts first (data cleanup before tables drop)
      const uninstallMod = await tryImportUninstall(slug)
      if (uninstallMod) {
        try {
          await uninstallMod.uninstall(ctx)
        } catch (uninstallErr) {
          console.error(`[installer] uninstall() rollback failed for "${slug}":`, uninstallErr)
        }
      }

      // Attempt rollback: uninstall.sql (DROP tables after data is cleaned)
      const uninstallPath = path.join(process.cwd(), 'apps', slug, 'uninstall.sql')
      try {
        const uninstallSql = await fs.readFile(uninstallPath, 'utf-8')
        const { error: rollbackSqlError } = await adminClient.rpc('exec_sql', { sql: uninstallSql })
        if (rollbackSqlError) console.error(`[installer] rollback SQL failed for "${slug}":`, rollbackSqlError.message)
      } catch {
        console.error(`[installer] could not read uninstall.sql for "${slug}" during rollback`)
      }

      await adminClient
        .from('installed_apps')
        .update({ status: 'error', error: errMsg })
        .eq('slug', slug)
      throw installErr
    }
  }

  const { error: updateError } = await adminClient
    .from('installed_apps')
    .update({ status: 'active', error: null })
    .eq('slug', slug)
  if (updateError) throw new Error(`Failed to mark "${slug}" as active: ${updateError.message}`)
}

export async function uninstallApp(slug: string): Promise<void> {
  const adminClient = createAdminClient()

  const manifest = await readManifest(slug)

  const allScanned = await scanApps()
  const { data: activeRows } = await adminClient
    .from('installed_apps')
    .select('slug, status')
    .eq('status', 'active')
  const activeSet = new Set((activeRows ?? []).map(r => r.slug))

  for (const scanned of allScanned) {
    if (scanned.slug === slug || !scanned.manifest) continue
    const deps = scanned.manifest.dependencies ?? []
    if (deps.includes(slug) && activeSet.has(scanned.slug)) {
      throw new InstallerError(
        'uninstall_blocked',
        {},
        `Cannot uninstall "${slug}": "${scanned.slug}" depends on it and is active`
      )
    }
  }

  await adminClient
    .from('installed_apps')
    .update({ status: 'uninstalling' })
    .eq('slug', slug)

  const ctx: AppInstallContext = { supabase: adminClient, manifest, slug }
  const uninstallMod = await tryImportUninstall(slug)
  if (uninstallMod) {
    try {
      await uninstallMod.uninstall(ctx)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await adminClient
        .from('installed_apps')
        .update({ status: 'error', error: errMsg })
        .eq('slug', slug)
      throw err
    }
  }

  const uninstallPath = path.join(process.cwd(), 'apps', slug, 'uninstall.sql')
  let uninstallSql: string | null = null
  try {
    uninstallSql = await fs.readFile(uninstallPath, 'utf-8')
  } catch {
    // optional file
  }

  if (uninstallSql) {
    const tableOpRe = /(?:drop\s+table|alter\s+table|delete\s+from|truncate\s+(?:table\s+)?)\s+(?:if\s+exists\s+)?["']?(\w+)["']?/gi
    let tableMatch: RegExpExecArray | null
    while ((tableMatch = tableOpRe.exec(uninstallSql)) !== null) {
      const tableName = tableMatch[1].toLowerCase()
      if (!tableName.startsWith(manifest.tablePrefix)) {
        throw new InstallerError(
          'uninstall_prefix_mismatch',
          { table: tableName, prefix: manifest.tablePrefix },
          `${slug}: uninstall.sql operates on table "${tableName}" which does not belong to this app (prefix: "${manifest.tablePrefix}")`
        )
      }
    }

    const { error: sqlError } = await adminClient.rpc('exec_sql', { sql: uninstallSql })
    if (sqlError) {
      await adminClient
        .from('installed_apps')
        .update({ status: 'error', error: sqlError.message })
        .eq('slug', slug)
      throw new Error(`uninstall.sql failed for "${slug}": ${sqlError.message}`)
    }
  }

  const { error: deleteError } = await adminClient
    .from('installed_apps')
    .delete()
    .eq('slug', slug)
  if (deleteError) throw new Error(`Failed to delete installed_app record for "${slug}": ${deleteError.message}`)
}
