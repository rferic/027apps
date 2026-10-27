# Infraestructura

Inventario de servicios, secretos y operación de una instancia desplegada. Complementa
[`docs/flows/cicd.md`](flows/cicd.md) (CI/CD y despliegue) y
[`docs/superpowers/specs/2026-10-26-backups.md`](superpowers/specs/2026-10-26-backups.md)
(decisión de backup). **Nunca** se escriben valores de secretos aquí: solo nombres.

> **Estado:** documento en construcción. Hoy cubre el inventario básico, backups y
> recuperación (task-12 del sprint de infra); despliegue, releases y el resto de la operación
> se completarán con las tareas de despliegue.

## 1. Servicios

| Servicio | Uso | Plan / límite | Si se pierde |
|---|---|---|---|
| GitHub (`rferic/027apps`) | Código, CI, releases del APK | Free (repo público: minutos de Actions sin coste) | El código vive en clones locales; el APK firmado requiere el keystore (gestor de contraseñas) |
| Vercel | Admin + `/api/v1` | Hobby | Se recrea desde el repo; solo hay que reponer env vars |
| Supabase | Postgres, Auth, Storage, Realtime | Free: **sin backups**, 500 MB de BD, pausa por inactividad (~1 semana) | **Se reconstruye** desde el backup + migraciones (este documento) |
| Supabase local (dev) | BD/Auth/Storage/Realtime para desarrollar y para el TDD de migraciones + RLS | Docker, sin coste; lo levanta `supabase start` | Se recrea con `supabase start`; `supabase db reset` deja la BD limpia y aplica las migraciones |
| Firebase (FCM) | Push | Free (opcional) | Se recrea el proyecto; los valores van en settings |
| Cloudflare R2 (o Backblaze B2) | Backups cifrados de la BD | R2: 10 GB gratis, sin coste de egress | **Punto único de los backups**: ver copia secundaria (§8) |
| healthchecks.io (opcional) | Vigilancia de que el backup corre | Free | Se pierde la alerta proactiva; queda el email de fallo de GitHub |

El titular de cada cuenta es el usuario (no un tercero). Las cuentas de un familiar que
monta su instancia son suyas: 027Apps no aloja datos de nadie.

## 2. Límites del free tier y mitigaciones

| Límite | Mitigación |
|---|---|
| Supabase pausa proyectos inactivos | `.github/workflows/keep-alive.yml` (ping diario a `/api/health`) |
| Sin backups ni PITR en Supabase | Backup propio diario cifrado fuera de Supabase (este documento) |
| 500 MB de BD / 1 GB de Storage en free | Uso familiar; si se acerca el límite, plan Pro o Supabase self-hosted (la migración ya está cubierta por el dump) |
| Emails de Auth limitados | SMTP propio en la configuración de Auth |
| Storage y egress limitados | Uso familiar; los ficheros aún no se respaldan (§8) |

## 3. Variables y secretos

Nombres y propósito. La tabla completa de despliegue está en
[`cicd.md`](flows/cicd.md#secretos); estos son los del backup:

| Nombre | Dónde | Uso |
|---|---|---|
| `SUPABASE_DB_URL` | GitHub Secrets | Conexión a Postgres para `pg_dump` (**session pooler**, puerto 5432, IPv4) |
| `RESTIC_REPOSITORY` | GitHub Secrets | Repo restic, p. ej. `s3:https://<account>.r2.cloudflarestorage.com/<bucket>/027apps` |
| `RESTIC_PASSWORD` | GitHub Secrets + gestor de contraseñas + papel | Clave de cifrado del repo. **Sin ella no hay recuperación** |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | GitHub Secrets | Token S3 **con alcance a un solo bucket** |
| `BACKUP_S3_REGION` | GitHub Variables | Región de firma S3 (`auto` en R2; la real en B2). Por defecto `auto` |
| `HEALTHCHECK_URL` | GitHub Secrets | Ping de éxito/fallo (healthchecks.io). Opcional |

Copias de los valores en el gestor de contraseñas del usuario, no solo en GitHub: si se
pierde la cuenta de GitHub, los secretos deben seguir siendo recuperables.

## 4. Backups

### Qué, cuándo y dónde

- **Qué**: `pg_dump --format=custom --no-owner` (un `.dump`). Incluye el esquema de
  producto (`public`), usuarios de Auth (`auth`) y metadatos de Storage (`storage`).
  **No** incluye los bytes de los buckets.
- **Cuándo**: diario a las 03:42 UTC, más ejecución manual
  (`workflow_dispatch`) **antes** de cualquier cambio destructivo (migración que borra
  columnas, limpieza de datos).
- **Dónde**: repositorio restic cifrado en un bucket privado de **otro proveedor**
  (Cloudflare R2 por defecto). Nunca dentro de Supabase ni en artifacts de GitHub.
- **Retención**: 7 diarios, 4 semanales y 12 mensuales (`restic forget --prune`).
- **Cifrado**: restic (AES-256 + autenticación). El bucket, aunque se filtre, es ilegible.
- **Coste**: la BD son megas; la deduplicación de restic mantiene el repo muy por debajo
  de los 10 GB gratuitos.

### Activación (puerta de usuario)

Orden: **primero** las protecciones de `main` (paso A de
[`cicd.md`](flows/cicd.md#a-protecciones-del-repo-y-solo-después-keystore-y-secrets-de-github)),
igual que con el keystore. Sin ellas, cualquiera con escritura puede modificar el workflow
y exfiltrar los secretos.

1. **Bucket privado** en Cloudflare R2 (recomendado) o Backblaze B2. No público, sin
   lifecycle que borre objetos (la retención la gestiona restic).
2. **Token S3 con alcance al bucket**: R2 → *Manage R2 API Tokens* → *Object Read & Write*,
   limitado a ese bucket. Guarda `Access Key ID` y `Secret Access Key`.
3. **Contraseña del repo**: `openssl rand -base64 48`. Al gestor de contraseñas **y** una
   copia impresa/offline. Es la llave de todos los backups.
4. **Conexión a la BD**: Dashboard de Supabase → *Connect* → **Session pooler**
   (`postgres.<ref>@aws-…pooler.supabase.com:5432`). Los runners de GitHub son IPv4-only y
   la conexión directa del plan free es IPv6. La cadena debe llevar la contraseña de la BD
   y `?sslmode=require`.
5. **Secretos** (repo `rferic/027apps`):
   ```bash
   gh secret set SUPABASE_DB_URL --repo rferic/027apps
   gh secret set RESTIC_REPOSITORY --repo rferic/027apps
   gh secret set RESTIC_PASSWORD --repo rferic/027apps
   gh secret set AWS_ACCESS_KEY_ID --repo rferic/027apps
   gh secret set AWS_SECRET_ACCESS_KEY --repo rferic/027apps
   gh variable set BACKUP_S3_REGION --repo rferic/027apps --body auto   # B2: región real
   gh secret set HEALTHCHECK_URL --repo rferic/027apps                  # opcional
   ```
6. **Vigilancia** (opcional, recomendado): crear un check en healthchecks.io con periodo
   diario y gracia de 6 h; pegar su ping URL en `HEALTHCHECK_URL`. Si el backup no corre,
   el check se pone rojo aunque GitHub no ejecute nada.
7. **Verificar**: lanzar el workflow (*Actions → Backup → Run workflow*) y comprobar el
   snapshot. Después, hacer el simulacro (§6) al menos una vez antes de dar la tarea por
   terminada.

### Comprobaciones automáticas

- `pg_restore --list` valida que el archivo no está truncado.
- `restic check` valida la estructura e integridad del repo en cada ejecución.
- Un fallo del workflow llega por email de GitHub; el ping ausente lo detecta healthchecks.
- **Nada de esto demuestra que el backup se restaura**: eso es el simulacro.

## 5. Recuperación

Requisitos en local: cliente PostgreSQL 17 (`pg_dump`, `pg_restore`, `psql`) y restic;
las variables de §3 exportadas. Todo el proceso está en `scripts/backup/`.

### Escenario A — datos borrados o corruptos en producción

1. **Guardar el estado actual** antes de tocar nada (evidencia y opción de comparar):
   ```bash
   scripts/backup/backup.sh
   ```
2. Elegir snapshot y revisar qué contiene:
   ```bash
   restic snapshots --host 027apps-supabase
   restic ls <snapshot>
   ```
3. Restaurar solo el esquema de producto sobre el mismo proyecto:
   ```bash
   scripts/backup/restore.sh --target "$SUPABASE_DB_URL" --snapshot <snapshot>
   ```
4. Si lo perdido son usuarios de Auth, se restauran aparte con `--schema all` en un
   proyecto vacío (no sobre producción) y se importan las filas necesarias.
5. Verificar con la app (login, listado, escritura) y revisar `/api/health`.

### Escenario B — proyecto Supabase perdido o cuenta cerrada

1. Crear un **proyecto Supabase nuevo** (misma región; guardar la contraseña de la BD).
2. Anotar los nuevos `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY`; actualizarlos en Vercel (Preview y Production) y redesplegar.
   La app Android no cambia: apunta al admin, no a Supabase.
3. Restaurar el esquema de producto:
   ```bash
   scripts/backup/restore.sh --target "$NEW_DB_URL" --schema public
   ```
4. Si existe `supabase_migrations`, restaurarlo también para que `supabase db push` no
   reaplique migraciones ya aplicadas:
   ```bash
   scripts/backup/restore.sh --target "$NEW_DB_URL" --schema supabase_migrations
   ```
   Alternativa: `supabase migration repair --status applied <version>` por cada migración.
5. Revisar extensiones que use el producto (`pgcrypto`, `uuid-ossp`, `pg_net`…):
   crear las que falten en el proyecto nuevo (`create extension if not exists …`).
6. Recrear los buckets de Storage y volver a subir los ficheros (aún no respaldados, §8);
   el dump solo trae los metadatos.
7. Usuarios: intentar el dump `all` en una BD desechable e importar `auth.users`; si GoTrue
   no arranca o los hashes no son compatibles, invitar/restablecer contraseñas.
8. Verificar login, datos y `/api/health`; lanzar un backup y un simulacro.

### Escenario C — pérdida de acceso a GitHub

El repo y los workflows pueden desaparecer, pero los datos no:

1. Usar un clon local del repo (mantener al menos uno actualizado en otro disco).
2. Exportar `SUPABASE_DB_URL`, `RESTIC_REPOSITORY`, `RESTIC_PASSWORD` y las credenciales
   S3 del gestor de contraseñas.
3. `scripts/backup/backup.sh` y `scripts/backup/restore.sh` funcionan igual en local.
4. Recrear el remoto (nuevo repo/organización) y volver a subir los secretos.

### Escenario D — bucket de backups perdido

Sin copia secundaria, los backups se pierden (§8). Acción inmediata: rotar el token S3,
crear un bucket nuevo, `restic init` (el script lo hace solo) y **empezar de cero**. Por eso
la copia secundaria está en pendientes.

## 6. Simulacro de restauración (trimestral)

Un backup que nunca se ha restaurado no es un backup. Cada trimestre, con el snapshot más
reciente:

1. Crear un **proyecto Supabase desechable** (free) o un Postgres local vacío.
2. Restaurar: `scripts/backup/restore.sh --target "$DRILL_DB_URL" --schema public`.
3. Verificar la integridad de los datos guardados (no solo la estructura):
   ```bash
   restic check --read-data
   ```
4. Comparar tablas y filas con la base de origen:
   ```bash
   psql "$SUPABASE_DB_URL" -Atc "select relname, n_live_tup from pg_stat_user_tables order by 1"
   psql "$DRILL_DB_URL" -Atc "select relname, n_live_tup from pg_stat_user_tables order by 1"
   ```
   `n_live_tup` es una estimación; para las tablas clave, `select count(*)`.
5. Comprobar una lectura real de la app contra el proyecto de pruebas (o una consulta que
   reproduzca la pantalla principal).
6. Borrar el proyecto desechable y anotar el resultado:

| Fecha | Snapshot | Tablas / filas | Resultado | Notas |
|---|---|---|---|---|
| — | — | — | — | Pendiente del primer simulacro |

## 7. Operación

- **Rotación del token S3**: anual o ante sospecha. Crear token nuevo, actualizar secrets,
  lanzar el workflow y revocar el viejo.
- **Rotación de `RESTIC_PASSWORD`**: `restic key add` con la nueva, actualizar el secret,
  comprobar un backup, `restic key remove` de la vieja. Guardar la nueva en el gestor.
- **Repo bloqueado** por una ejecución interrumpida: comprobar que no hay otra en curso y
  `restic unlock`. El workflow no lo hace solo para no tapar una ejecución concurrente.
- **Migraciones**: el backup diario no sustituye a un backup previo en cambios destructivos;
  lanza `workflow_dispatch` antes del merge.
- **Bajas**: si se abandona una instancia, borrar bucket y secrets, y destruir las copias
  en papel de la contraseña.

## 8. Pendientes

| Pieza | Estado |
|---|---|
| Ficheros de Storage (bytes) | Pendiente: `rclone`/`aws s3 sync` contra `https://<ref>.storage.supabase.co/storage/v1/s3` con claves S3 del proyecto, dentro del mismo snapshot de restic |
| Copia secundaria (3-2-1) | Pendiente: `restic copy` a un bucket de otro proveedor |
| Simulacro automatizado | Pendiente: requiere Supabase self-hosted o proyecto desechable por API |
| Inventario completo de servicios y variables | Pendiente: tareas de despliegue |
