---
id: sprint-13-task-07
titulo: Backup cifrado de la base de datos fuera de Supabase
area: infra
estado: test
plan: docs/superpowers/plans/2026-11-08-staging-production.md
fuente: docs/superpowers/specs/2026-10-26-backups.md
adrs: [0010]
---

**Tarea**: que la BD de producción tenga un respaldo diario, cifrado y **externo a Supabase**,
con restauración documentada y probada. El plan free de Supabase no incluye backups ni PITR:
hoy la instancia no tiene ninguna copia recuperable.

**Traslado** (2026-11-08): movida desde `sprint-11-prod-activation/task-02` (que a su vez vino
de `sprint-04-infra`) a `sprint-13-staging-prod` — la verificación real (primer snapshot +
simulacro de restauración) exige el proyecto `027apps-prod`, que se crea en este sprint
(tarea 06). **La BD objetivo pasa a ser `027apps-prod`** (antes no existía).

**Piezas implementadas** (rama `sprint/11-infra-backups`):
- `scripts/backup/backup.sh` — `pg_dump` en formato custom, validación del TOC, `restic
  backup`/`forget` (7 diarios / 4 semanales / 12 mensuales) y `restic check`.
- `scripts/backup/restore.sh` — restauración de un snapshot en una BD destino; `--schema
  public` (por defecto, ruta de recuperación normal) o `--schema all` (rescate completo).
- `.github/workflows/backup.yml` — diario a las 03:42 UTC y `workflow_dispatch`,
  `permissions: {}`, restic fijado por SHA-256, pasos omitidos si faltan secrets.
- `docs/infrastructure.md` — inventario, secretos, backups, escenarios de recuperación,
  simulacro trimestral y operación.
- `docs/flows/cicd.md` — workflow, trigger, secretos, degradación en forks y activación.

**Pendiente (puerta de usuario)**:
1. Bucket privado en Cloudflare R2 o Backblaze B2 + token S3 con alcance a ese bucket.
2. `RESTIC_PASSWORD` en el gestor de contraseñas **y** en una copia en papel.
3. `SUPABASE_DB_URL` de `027apps-prod` con la cadena del session pooler (IPv4) y la contraseña
   de la BD.
4. Cargar `SUPABASE_DB_URL`, `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, `AWS_ACCESS_KEY_ID` y
   `AWS_SECRET_ACCESS_KEY` (y `BACKUP_S3_REGION` si no es R2); comandos en el runbook.
5. `workflow_dispatch` del backup y primer simulacro de restauración.

**Criterios de aceptación**: un `workflow_dispatch` deja un snapshot restaurable en el bucket;
`restore.sh` recupera `public` con datos verificables en un Postgres limpio; sin secretos el
workflow queda en verde; el runbook permite recuperar sin acceso a GitHub ni a Supabase;
primer simulacro anotado; auditoría de seguridad superada.

**Verificación**: seguida en `docs/superpowers/plans/2026-10-26-backups.md` (dump → restic →
restore → 3 filas verificadas contra Postgres 17 en Docker, repetido dos veces).

**Notas**:
- El backup completo (`all`) incluye `auth` y `storage`; la recuperación normal restaura
  `public` y reconstruye el proyecto con migraciones. Los ficheros de Storage aún **no** se
  respaldan (§8 del runbook).
- La spec decide explícitamente no usar los backups del plan Pro: seguirían dentro de Supabase
  y no protegen del cierre de cuenta.

## Ejecución (2026-11-10)

- **Bucket**: Backblaze B2 `027apps-backups-ericrf`, endpoint `s3.us-east-005.backblazeb2.com`
  (región `us-east-005`), privado. Application Key limitada a ese bucket (Read and Write).
- **Secrets** en GitHub (nivel repo): `SUPABASE_DB_URL`, `RESTIC_REPOSITORY`,
  `RESTIC_PASSWORD` (44 caracteres, en el gestor y en papel), `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`; variable `BACKUP_S3_REGION=us-east-005`.
- **Primer backup real** (`workflow_dispatch`, run `42835565362`): dump de 474 KB, snapshot
  `b9e91cbf` (host `027apps-supabase`, tag `postgres`), `restic check` sin errores, retención
  7 diarios / 4 semanales / 12 mensuales aplicada.
- **Simulacro de restauración** (`restore-drill.yml`, run `42852921573`): Postgres 17
  desechable en CI, restauración de `public`+`auth` en `public tables: 19`, `settings rows: 18`.
- **Arreglos que hizo falta** (todos mergeados):
  1. El workflow instalaba `postgresql-client-17` pero `pg_dump` seguía siendo el 16 de la
     imagen → `PATH` a `/usr/lib/postgresql/17/bin`.
  2. El drill necesita los roles de Supabase (`anon`, `authenticated`, `service_role`,
     `supabase_admin`, `dashboard_user`, …) y los de las migraciones (`core_cron`,
     `module_installer`) antes de `pg_restore`.
  3. Restaurar solo `public` falla por `profiles_id_fkey → auth.users`; la restauración debe
     incluir `auth` (`--schema public,auth`). `session_replication_role=replica` **no** evita
     la validación al crear la constraint.
- **Decisión de operación**: el simulacro trimestral se lanza con `workflow_dispatch` de
  `restore-drill.yml` desde `main`; no requiere herramientas ni credenciales locales.

**Pendiente**: revisión de otro agente y auditoría de seguridad para pasar a `finalizada`.
