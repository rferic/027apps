---
id: sprint-infra-task-12
titulo: Backup cifrado de la base de datos fuera de Supabase
area: infra
estado: test
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: docs/superpowers/specs/2026-10-26-backups.md
---

**Tarea**: que la BD de producción tenga un respaldo diario, cifrado y **externo a Supabase**,
con restauración documentada y probada. El plan free de Supabase no incluye backups ni PITR:
hoy la instancia no tiene ninguna copia recuperable.

**Piezas implementadas** (rama `sprint/infra-backups`):
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
3. `SUPABASE_DB_URL` con la cadena del session pooler (IPv4) y la contraseña de la BD.
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
