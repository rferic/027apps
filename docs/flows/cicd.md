# Flujo CI/CD de extremo a extremo

Definición completa del flujo de integración y entrega de 027Apps. Se define entero y se implementa por partes: lo que aún no está implementado se marca como tal.

| Pieza | Estado |
|---|---|
| Gates de CI (`admin`, `android`, `guard-secrets`) | Implementado (`.github/workflows/ci.yml`) |
| Release firmado de Android en tag `v*` | Implementado, pendiente de keystore (ver [Pendiente de ejecución](#pendiente-de-ejecución-puerta-de-usuario)) |
| Keep-alive diario | Implementado (`.github/workflows/keep-alive.yml`), inactivo hasta que exista el secret `PROD_URL` |
| `commitlint` | Implementado (`.github/workflows/ci.yml`, config `.commitlintrc.json`); valida el título del PR |
| Deploy Vercel (preview/prod) | Definido; **en pausa** (decisión del usuario 2026-10-25) hasta que exista un core funcional — ver paso B |
| Migraciones Supabase | Definido; se implementa cuando exista la primera migración |
| Backup diario de la BD | Implementado (`.github/workflows/backup.yml`), inactivo hasta crear el bucket y los secrets (ver [paso C](#c-backups-bucket-y-secrets)) |

## Principios

1. Todo lo que entra a `main` pasa gates mecánicos (no hay revisión manual que sustituya a un check).
2. Cada PR tiene un preview desplegable.
3. Producción solo se despliega desde `main` en verde.
4. Los secretos viven únicamente en GitHub Secrets / Vercel / el gestor de contraseñas del usuario; nunca en git.
5. Un fork sin secretos ejecuta solo los gates locales y omite (sin fallar) deploy, migraciones y keep-alive.
6. El rollback es siempre un `git revert` en `main`.

## Triggers

| Workflow | Trigger | Qué ejecuta |
|---|---|---|
| `ci.yml` | `pull_request` (`opened`, `synchronize`, `reopened`, `edited`; cualquier rama destino) | `admin`, `android`, `guard-secrets`, `commitlint` |
| `ci.yml` | `push` a `main` | los mismos checks sobre el commit mergeado |
| `ci.yml` | `push` de tag `v*` | los mismos checks + job `release` |
| `keep-alive.yml` | `schedule` diario (06:17 UTC) y `workflow_dispatch` | ping a producción si existe `PROD_URL` |
| `backup.yml` | `schedule` diario (03:42 UTC) y `workflow_dispatch` | dump de Postgres + subida cifrada a restic si existen los secrets |
| *(Dependabot)* | `.github/dependabot.yml`: semanal, agrupado (npm, actions, gradle), **sin auto-merge** | PRs de dependencias; una security update no espera a la semana |
| Vercel (app externa) | PR → preview; `main` → producción | deploy de `apps/admin` |

`ci.yml` usa `concurrency` por ref: un push nuevo a un PR cancela la ejecución anterior; en `main` y tags nunca se cancela.

## Gates (jobs de `ci.yml`)

Todos corren en `ubuntu-latest` con permisos `contents: read` (solo `release` sube a `contents: write`).

| Job | Pasos | Quién lo ejecuta | Qué verifica |
|---|---|---|---|
| `admin` | checkout → pnpm (versión de `packageManager`) → Node 22 con caché → `pnpm install --frozen-lockfile` → `lint` → `tsc` → `test` → `build` | GitHub Actions | El lockfile está sincronizado; ESLint, tipos (`next typegen && tsc --noEmit`), vitest y `next build` pasan. Sin env vars de Supabase: `/api/health` responde 503 `degraded`, es lo esperado y el job **no** debe tener secrets para "arreglarlo". |
| `android` | checkout → JDK 17 (temurin) → Android SDK con licencias aceptadas (`android-actions/setup-android`; AGP descarga la plataforma 37) → `gradle/actions/setup-gradle` (caché; `apps/android/gradle.properties` sube el heap del daemon a 3 GB porque D8 se quedaba sin memoria con el valor por defecto en los runners) → `./gradlew :app:testDebugUnitTest :app:assembleDebug` → sube el artifact `apk-debug` | GitHub Actions | Tests unitarios pasan, el APK debug se genera y queda descargable 90 días (retención por defecto) para probar el PR en un dispositivo. |
| `guard-secrets` | checkout → script que falla si git rastrea `.env*` (salvo `*.example`), `*.jks`/`*.keystore`/`*.p12`/`*.pem`/`*.key`/`*.p8`, o si el árbol contiene valores con forma de secreto (`sbp_…`, `sb_secret_…`, cualquier JWT —las claves anon/service de Supabase lo son—, `SERVICE_ROLE_KEY=<valor>`, bloques `-----BEGIN … PRIVATE KEY-----`) | GitHub Actions | Ningún secreto ni keystore se ha colado en git. Solo imprime **nombres de archivo**, nunca el contenido que coincide. Los patrones usan clases de caracteres que impiden que coincidan con su propio texto en `ci.yml`, así que no hace falta excluir el directorio de workflows. |
| `commitlint` | checkout → Node 22 → `commitlint` (versiones fijadas, vía `npx`) sobre el título del PR, pasado por variable de entorno | GitHub Actions | El título del PR cumple Conventional Commits (`feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`, `perf`, `build`). Solo corre en `pull_request`; en push/tag se omite. Como el squash merge usa el título como mensaje del commit en `main`, validar el título es validar el commit. Renombrar el PR (`edited`) relanza el CI y el `concurrency` cancela la ejecución anterior. |
| `release` | solo en tag `v*`, y solo si el commit etiquetado es ancestro de `origin/main` (`git merge-base --is-ancestor "$GITHUB_SHA" origin/main`, con `fetch-depth: 0`; si no, el job falla antes de tocar secrets); corre en el Environment `release`; ver [Distribución Android](#distribución-android-y-actualizaciones) | GitHub Actions | APK firmado y publicado. |

Los checks `admin`, `android`, `guard-secrets` y `commitlint` son los que se marcarán como requeridos en la protección de `main`.

## Secretos

| Secret | Dónde | Uso | Si falta |
|---|---|---|---|
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | GitHub Secrets (Environment `release`) | Firma del APK de release (solo job `release`) | En un fork el release se omite con aviso; en el repo original el job `release` **falla** (un tag sin firmar no debe pasar desapercibido) |
| `PROD_URL` | GitHub Secrets | URL base de producción para el keep-alive | El ping se omite (paso con `if`, job en verde) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel (Preview y Production) | Runtime de `apps/admin` | `/api/health` devuelve 503 `degraded` |
| Credenciales de migraciones (token/ DB password de Supabase) | GitHub Secrets (futuro) | Job de migraciones | El job de migraciones se omite |
| `SUPABASE_DB_URL` | GitHub Secrets | Backup: conexión a Postgres (session pooler, puerto 5432) | Todos los pasos del backup se omiten (job en verde) |
| `RESTIC_REPOSITORY`, `RESTIC_PASSWORD` | GitHub Secrets | Backup: repositorio restic y su clave de cifrado | Todos los pasos del backup se omiten |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | GitHub Secrets | Backup: token S3 con alcance a un bucket | Todos los pasos del backup se omiten |
| `HEALTHCHECK_URL` | GitHub Secrets | Backup: ping de éxito/fallo (healthchecks.io) | Sin ping externo; queda el email de fallo de GitHub |
| `BACKUP_S3_REGION` | GitHub Variables | Backup: región de firma S3 (`auto` en R2) | Valor por defecto `auto` |

Reglas de manejo de secretos:

- GitHub no permite leer `secrets.*` en un `if:`. El patrón es pasar el secret a `env` y condicionar con `if: env.X != ''` (o comprobarlo en un paso y exponer un output). Así los pasos dependientes se **omiten** en lugar de fallar con el valor vacío.
- Los secrets se inyectan por paso (no a nivel de workflow) y solo en los pasos que los necesitan, para que las acciones de terceros no los vean.
- Nunca se hace `echo` de un secret ni se interpola `${{ secrets.* }}` dentro de un script `run:`; siempre vía variable de entorno.
- No se usa `pull_request_target`: el código de un PR (incluidos los forks) nunca se ejecuta con secrets. Los PR de forks no reciben secrets y el release solo se dispara por tag en el repo.
- `permissions` mínimos por workflow/job.

## Despliegues

**Quién despliega:** Vercel (integración Git), no GitHub Actions. **Qué lo verifica:** el check de Vercel en el PR y, en producción, el keep-alive.

> **Alcance actual:** el deploy a producción **no procede hasta que exista un core funcional** (datos, API de producto, pantallas con lógica real). Hoy el repo es solo fundaciones (tooling, identidad, design system base); desplegar ahora no aporta nada. El paso B de [Pendiente de ejecución](#pendiente-de-ejecución-puerta-de-usuario) (conectar Vercel) queda **en pausa hasta entonces**, por decisión del usuario (2026-10-25).

1. PR abierto/actualizado → Vercel despliega un **preview** de `apps/admin` y comenta la URL en el PR.
2. Merge a `main` (solo posible con los checks requeridos en verde) → Vercel despliega **producción**.
3. Un push directo a una rama que no sea `main` y sin PR no despliega producción.

## Migraciones Supabase

Aún no existe ninguna migración; el orden queda definido para cuando aparezca la primera:

1. El PR con la migración tiene preview contra el proyecto Supabase de desarrollo/preview (nunca contra producción).
2. Merge a `main` → Vercel despliega el admin.
3. **Después del deploy del admin** un job en `main` (con secrets de Supabase) aplica las migraciones pendientes a producción (`supabase db push`).
4. **Antes del keep-alive**: el keep-alive diario solo valida salud tras migrar; si la migración falla el job queda en rojo y el siguiente ping no enmascara el problema.
5. Las migraciones deben ser compatibles hacia atrás con la versión anterior del admin (expand → migrate → contract): el admin nuevo ya está desplegado cuando se aplica la migración y un rollback de código debe seguir funcionando.
6. Sin secrets de Supabase (forks) el job de migraciones se omite sin fallar.

## Backups

El backup **no** vive en Supabase: es un dump lógico diario, cifrado con restic y guardado
en un bucket S3-compatible de **otro proveedor**. Retención, cifrado y runbook de
recuperación: [`docs/infrastructure.md`](../infrastructure.md#4-backups).

- **Workflow**: `backup.yml` a las 03:42 UTC y `workflow_dispatch`; `permissions: {}` y
  `concurrency` para que dos ejecuciones no colisionen en el repositorio restic.
- **Scripts**: `scripts/backup/backup.sh` (CI y local) y `scripts/backup/restore.sh`
  (recuperación y simulacro). El mismo código funciona sin GitHub: es parte del modelo de
  amenaza.
- **Antes de cambios destructivos**: lanzar el backup a mano antes de mergear una migración
  que borre o transforme datos.
- **Orden con migraciones**: no hay dependencia técnica (corren a horas distintas); el
  backup diario refleja el estado del día anterior, no el de hace un minuto.
- **Verificación**: TOC (`pg_restore --list`) y `restic check` en cada ejecución, más un
  simulacro de restauración trimestral. Un backup sin simulacro no es una recuperación
  probada.

## Rollback

- **Código/admin:** `git revert <sha>` del commit (o PR) en `main` → PR → mismos gates → Vercel despliega el estado anterior. Alternativa de emergencia: promover en Vercel el deployment anterior (se reconcilia después con el `revert` en git, que sigue siendo la fuente de verdad).
- **Migraciones:** no se revierten con `git revert`; se corrige hacia delante con una migración nueva (por eso deben ser compatibles hacia atrás).
- **Android:** un release malo se corrige publicando un tag nuevo con `versionCode` mayor (Android no permite bajar de versión); el release defectuoso se marca como pre-release/borrador en GitHub.

## Degradación en forks

Un fork (o un PR desde un fork) no tiene secrets. Resultado esperado, sin fallos por falta de secrets:

| Pieza | Comportamiento en fork |
|---|---|
| `admin`, `android`, `guard-secrets` | Se ejecutan completos (no necesitan secrets) |
| `release` | Con `github.event.repository.fork == true` y sin keystore: aviso `::notice::` y todos los pasos de build/publicación se omiten; el job termina en verde |
| `keep-alive` | Los workflows programados vienen deshabilitados en forks; si se lanza a mano, `PROD_URL` vacío omite el ping |
| Vercel | No está conectado en el fork: no hay deploy |
| Migraciones | Se omiten (sin secrets) |
| `backup` | Todos los pasos se omiten (sin `SUPABASE_DB_URL`); el job queda en verde |

Se puede comprobar leyendo las condiciones: ningún paso exige un secret sin una guarda previa y ninguna guarda convierte la ausencia de secret en un error salvo el caso del repo original en un tag (intencionado).

## Distribución Android y actualizaciones

La distribución familiar es **un enlace de descarga**: la página de GitHub Releases del repo (`https://github.com/rferic/027apps/releases/latest`). No hay Play Store.

### El keystore

- El APK de release se firma con un keystore propio. **El archivo vive solo en GitHub Secrets (base64)** y su **copia de seguridad en el gestor de contraseñas del usuario**; nunca en git (`.gitignore` + `guard-secrets`).
- `apps/android/app/build.gradle.kts` lee `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` del entorno y **solo firma cuando existen las cuatro** (no vacías). Sin ellas, `assembleRelease` produce `app-release-unsigned.apk`; con ellas decodifica el keystore a `app/build/signing/` (ignorado por git) y firma.
- **Si se pierde el keystore no habrá actualizaciones firmadas**: Android no instala una versión con otra clave sobre la existente; los usuarios tendrían que desinstalar y reinstalar perdiendo datos locales.

### Flujo "nueva versión"

| # | Paso | Quién | Qué lo verifica |
|---|---|---|---|
| 1 | Subir `versionCode` (obligatorio, debe ser mayor que el anterior) y `versionName` en `apps/android/app/build.gradle.kts`, mergear a `main` | Desarrollador, vía PR | Gates de CI |
| 2 | Crear y empujar el tag: `git tag vX.Y.Z && git push origin vX.Y.Z` (un tag con `-`, p. ej. `v0.1.0-sprint1`, se publica como pre-release) | Desarrollador | — |
| 3 | `ci.yml` corre `admin`, `android` y `guard-secrets` sobre el tag; `release` espera a los tres (`needs`) | GitHub Actions | Checks en verde |
| 4 | `release`: comprueba que el commit del tag es ancestro de `main` (falla si no) → comprueba que están los 4 secrets → `./gradlew :app:assembleRelease` firmado → `apksigner verify --print-certs` → `gh release create` con el APK `027apps-<tag>.apk` y notas autogeneradas | GitHub Actions | El job falla si el commit no está en `main`, si falta un secret, si la firma no verifica o si no se genera el APK |
| 5 | Los usuarios abren el enlace de Releases en su móvil, descargan la APK e instalan (la primera vez habilitan "instalar apps de orígenes desconocidos" para su navegador) | Usuarios | Android instala la actualización sobre la versión anterior solo si la clave de firma y el `applicationId` coinciden y `versionCode` es mayor |

La app **no** se actualiza sola: cada usuario instala la nueva APK manualmente desde el enlace. (Un aviso in-app de nueva versión queda fuera de esta definición.)

### Verificación de extremo a extremo (tag → instalación)

1. Tag `v0.1.0-sprint1` → CI publica el Release con el APK firmado.
2. Descargar el APK desde el enlace del Release.
3. `apksigner verify --print-certs` muestra el certificado propio (no el de debug).
4. Instalar en un dispositivo/emulador; la app abre y muestra "027Apps".

## Pendiente de ejecución (puerta de usuario)

Estos pasos requieren al usuario y **no se han ejecutado**; el código que los consume ya está implementado y se omite o falla de forma controlada hasta que se hagan.

### A. Protecciones del repo y, solo después, keystore y secrets de GitHub

**Orden obligatorio: las protecciones (1–2) van ANTES de subir cualquier secret de firma (4+).** Hasta que existan, cualquier colaborador con permiso de escritura podría empujar un tag `v*` sobre un commit arbitrario y exfiltrar el keystore a través del job `release`. La guarda de CI (ancestro de `main`) funciona sin ellas pero no las sustituye.

1. **Proteger `main`** (*Settings → Branches* o un ruleset): exigir PR y los cuatro checks `admin`, `android`, `guard-secrets`, `commitlint` (y el check de Vercel cuando esté conectado); sin force-push ni borrado. Acción de administrador: no se puede hacer con `gh` sin acceso admin a la API.
2. **Ruleset para tags** (*Settings → Rules → Rulesets*): target *Tags*, patrón `v*`, restringir creación (y actualización/borrado) a administradores del repo.
3. **Environment `release`** (*Settings → Environments*): con *Required reviewers* (el propietario) y, opcionalmente, *Deployment branches and tags* limitado a `v*`. El job `release` ya declara `environment: release`; los secrets de firma deben guardarse **en ese Environment** (no a nivel de repositorio) para que solo ese job, tras aprobación, pueda leerlos.

Detalle y comandos exactos del keystore en [`apps/android/keystore/README.md`](../../apps/android/keystore/README.md). Resumen:

4. Generar el keystore en local:
   ```bash
   keytool -genkeypair -v -keystore 027apps-release.jks -alias 027apps \
     -keyalg RSA -keysize 4096 -validity 10000
   ```
5. Guardar el `.jks`, el alias y las dos contraseñas en el gestor de contraseñas (**si se pierde, no habrá actualizaciones firmadas**).
6. Subir los secrets al Environment `release` (solo cuando 1–3 estén hechos):
   ```bash
   gh secret set ANDROID_KEYSTORE_BASE64 --env release --repo rferic/027apps < <(base64 < 027apps-release.jks)
   gh secret set ANDROID_KEYSTORE_PASSWORD --env release --repo rferic/027apps
   gh secret set ANDROID_KEY_ALIAS --env release --repo rferic/027apps --body 027apps
   gh secret set ANDROID_KEY_PASSWORD --env release --repo rferic/027apps
   ```
7. Borrar el `.jks` local.
8. Opcional: `gh secret set PROD_URL --repo rferic/027apps --body https://<dominio-de-produccion>` para activar el keep-alive.
9. Verificación (Step 6 de la Task 4): crear el tag `v0.1.0-sprint1`, comprobar el Release con el APK firmado, instalarlo y ver "027Apps".

### B. Conectar Vercel

> **En pausa por decisión del usuario (2026-10-25):** no se conecta hasta que exista un core funcional que desplegar. Este paso solo se ejecuta cuando se cumpla esa condición.

1. En Vercel: *Add New → Project → Import Git Repository* → `rferic/027apps`.
2. **Root Directory:** `apps/admin`. Framework: Next.js (autodetectado). Con la raíz en `apps/admin`, Vercel instala con el `pnpm-lock.yaml` del monorepo (activar "Include source files outside of the Root Directory").
3. Añadir env vars (Preview **y** Production) del proyecto Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (esta última nunca con prefijo `NEXT_PUBLIC_`). Usar un proyecto Supabase distinto para Preview si es posible.
4. *Production Branch:* `main`.
5. Verificación: abrir un PR de prueba → aparece el preview de Vercel y `/api/health` responde `{"status":"ok"}`; mergear → producción.
6. La protección de `main` se hace en el paso A (antes del keystore); añade aquí el check de Vercel a los checks requeridos.

### C. Backups (bucket y secrets)

Después del paso A, por el mismo motivo que el keystore. Detalle en
[`docs/infrastructure.md`](../infrastructure.md#activación-puerta-de-usuario).

1. Bucket privado en Cloudflare R2 o Backblaze B2, y token S3 con alcance a ese bucket.
2. `RESTIC_PASSWORD` (`openssl rand -base64 48`) al gestor de contraseñas y a una copia en papel.
   Sin ella no se puede descifrar ningún backup.
3. `SUPABASE_DB_URL` con la cadena del **session pooler** (IPv4) y la contraseña de la BD.
4. Cargar `SUPABASE_DB_URL`, `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, `AWS_ACCESS_KEY_ID` y
   `AWS_SECRET_ACCESS_KEY` (comandos en el runbook); `BACKUP_S3_REGION` si no es R2.
5. Verificación: *Actions → Backup → Run workflow* deja un snapshot en el repo; después,
   simulacro de restauración (§6 del runbook) antes de marcar la tarea como terminada.
