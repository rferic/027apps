# Sprint Infra — Plan de implementación (puertas de setup del usuario)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar la instancia operativa y protegida: Supabase + envs, clave maestra de secretos, SMTP, Vercel con previews, protecciones de GitHub, Firebase/FCM provisionado, keystore de release, keep-alive y backup cifrado verificado — cada control con evidencia real, no "verde" a secas.

**Architecture:** Doce tareas en dos formas: (a) **puertas de setup** que ejecuta el usuario en paneles externos (Supabase, Vercel, Firebase, ajustes de GitHub) con guía y verificación del agente; (b) **cambios de repo** que ejecuta el agente (`.github/CODEOWNERS`, patrones de `guard-secrets`, estados en docs). Lo que necesita el Core implementado (settings cifrados, push real, release real, keep-alive contra producción) se **provisiona ahora** y se **verifica en su sprint** (05/06); cada tarea lo declara.

**Tech Stack:** GitHub (rulesets, Environments, Secrets, Actions), Supabase (proyecto + custom SMTP), Vercel (previews de `apps/admin`), Firebase (FCM), restic sobre bucket S3-compatible (R2/B2), `gh` CLI, `keytool`, `openssl`, Docker (simulacro de restauración).

**Spec:**
- `docs/flows/cicd.md` — §Pendiente de ejecución (A/B/C), §Secretos, §Degradación en forks, §Distribución Android
- `docs/tasks/sprint-infra/task-01..12.md` — alcance y criterios de aceptación por tarea
- `docs/infrastructure.md` — runbook operativo (secretos, backups, escenarios de recuperación)
- `docs/conventions/definition-of-done.md` §Infra — evidencia real + auditoría OWASP por tarea
- `docs/superpowers/specs/2026-10-26-instance-config.md` §5 (clave maestra) · `2026-10-26-realtime-notificaciones.md` §6 (FCM) · `2026-10-26-backups.md`

## Global Constraints

- **Secretos**: nunca en git, logs ni chat (AGENTS.md). El agente **jamás recibe ni imprime un valor de secreto**: el usuario ejecuta los comandos que los contienen; el agente verifica **presencia** (`gh secret list`, `vercel env ls`), nunca valores.
- **Evidencia (DoD Infra §2)**: el check debe **fallar cuando debe fallar** y pasar cuando debe pasar, con salida real (`gh pr checks`, logs de run) citada en el fichero de tarea.
- **Auditoría de seguridad incondicional** por tarea (DoD Infra §3): secretos, permisos de workflow, acciones de terceros, exposición de credenciales. Cualquier cambio de CI/CD actualiza `docs/flows/cicd.md` en el mismo PR.
- **Orden anti-exfiltración (cicd.md §A)**: las protecciones de `main` y tags (infra-01/02) van **antes** de subir el keystore (infra-03). La tarea del keystore re-verifica las protecciones antes de subir nada.
- **Forks degradan sin fallar** (cicd.md): ningún paso nuevo puede exigir un secret sin guarda previa; la única excepción intencionada es `release` en el repo original con tag.
- **Sin `pull_request_target`**; `permissions` mínimos; secretos inyectados por paso, no a nivel de workflow.
- **Superficie de GitHub en inglés** (ramas, commits, PRs); docs internos en español. Conventional Commits; `guard-secrets` y `commitlint` en verde.
- **2FA activa** en GitHub, Supabase, Vercel, Firebase y el proveedor SMTP (T15 del modelo de amenazas).
- Un PR por cambio de repo (las puertas de usuario no generan PR salvo docs); squash merge solo con orden explícita del usuario.

## Review Focus

Fallas que este setup no debe dejar atrás; cada línea tiene su verificación fijada en la tarea dueña:

1. **Un valor de secreto llega al agente o a un log** → infra-04/09/12: los comandos con secretos los ejecuta el usuario; la verificación del agente solo comprueba presencia (`gh secret list` muestra nombres) y resultado (`/api/health` → `ok`), nunca valores.
2. **Ventana de exfiltración: secrets subidos antes de las protecciones** → infra-03 (keystore): su primer paso re-verifica con `gh api .../rulesets` que las reglas de `main` y `v*` están activas antes de subir cualquier secret.
3. **Regresión de `guard-secrets` que se detecte a sí mismo** (los patrones literales nuevos coinciden con el texto del workflow) → infra-11: los patrones nuevos no pueden coincidir con su propia fuente y se prueban con fixture en rojo → verde, dos commits.
4. **Pérdida del keystore** (sin él no hay actualizaciones firmadas nunca más) → infra-03: restaurar el `.jks` desde el gestor de contraseñas **antes** de borrar la copia local y verificar el SHA-256.
5. **Backup nunca restaurado** (no es una recuperación, es una ilusión) → infra-12: simulacro real con `restore.sh` en Postgres 17 en Docker y verificación de filas, anotado en `docs/infrastructure.md`.
6. **Pérdida de `SETTINGS_ENCRYPTION_KEY`** (= secretos irrecuperables) → infra-09: la copia se guarda **separada** del backup de la BD y se anota dónde; verificación de uso diferida a sprint-05 task-04.

---

### Task 1 — infra-04: Proyecto Supabase + envs (la puerta)

**Files:**
- Modify: `docs/infrastructure.md` (fila de Supabase en el inventario: nombres/refs de proyecto, sin claves)
- Local (nunca en git): `apps/admin/.env.local`

**Interfaces:**
- Produces: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` presentes en `.env.local` local (dev) — las consume sprint-05 (migraciones, auth, `/api/health`) y la tarea 4 las sube a Vercel.

- [ ] **Step 1: (usuario) Crear el proyecto de desarrollo**

En supabase.com con 2FA: nueva organización → proyecto **`027apps-dev`** (región cercana, p. ej. `eu-central-1`), contraseña de BD generada y guardada en el gestor de contraseñas. Anotar el **project ref** (no es secreto).

> El proyecto de **producción** se crea al cierre de sprint-05 (free tier: un proyecto idle se pausa; no crear ahora lo que no se usa). Queda registrado como puerta del roadmap.

- [ ] **Step 2: (usuario) Copiar las tres variables al entorno local**

Dashboard → Settings → API: `Project URL`, `anon public`, `service_role`. Escribirlas en `apps/admin/.env.local` (el usuario, en su editor; el agente no ve valores).

- [ ] **Step 3: (agente) Verificar que `.env.local` está ignorado por git**

Run: `git check-ignore apps/admin/.env.local && git ls-files apps/admin/.env.local | wc -l`
Expected: imprime la ruta (ignorado) y `0` (no rastreado).

- [ ] **Step 4: (agente) E2E local de salud contra el proyecto real**

Run: arrancar `pnpm --filter admin dev` y `curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/health`
Expected: `200` (con envs, `/api/health` hace `listUsers` real; sin envs devolvería `503 degraded` — ese contraste es la evidencia).

- [ ] **Step 5: (agente) Documentar y cerrar**

Actualizar `docs/infrastructure.md` (fila Supabase: `027apps-dev`, ref, propósito dev/preview; prod "al cierre de sprint-05") y el estado de `docs/tasks/sprint-infra/task-04.md` → `finalizada` con la evidencia del paso 4. La subida a Vercel es la tarea 4 de este plan.

### Task 2 — infra-09: `SETTINGS_ENCRYPTION_KEY` (clave maestra)

**Files:**
- Modify: `docs/infrastructure.md` (sección de la clave: dónde vive la copia, sin el valor)
- Local (nunca en git): `apps/admin/.env.local` (el usuario añade la línea)

**Interfaces:**
- Produces: `SETTINGS_ENCRYPTION_KEY` disponible en el entorno local (dev) y, tras la tarea 4, en Vercel (Preview + Production). La consume sprint-05 task-04 (cifrado AES-256-GCM de settings).

- [ ] **Step 1: (usuario) Generar la clave sin que el agente la vea**

Run (el usuario, en su terminal): `openssl rand -base64 32` → copiar el resultado **directamente** al gestor de contraseñas. La salida no se pega en chat, tickets ni docs.

- [ ] **Step 2: (usuario) Copia separada del backup de la BD**

Guardar la clave en el gestor de contraseñas en una entrada propia, **marcada** como "secreta y distinta del backup de la BD" (backup + clave = texto claro). Confirmar verbalmente dónde está la copia; el agente lo anota en `docs/infrastructure.md` (ubicación, nunca valor).

- [ ] **Step 3: (usuario) Añadirla a `.env.local` y (tras tarea 4) a Vercel**

`SETTINGS_ENCRYPTION_KEY=<valor>` en `apps/admin/.env.local`; en Vercel (Preview + Production) cuando la tarea 4 esté hecha.

- [ ] **Step 4: (agente) Cubrir la fuga en CI y documentar**

La detección de la clave hardcodeada es la tarea 9 de este plan (`guard-secrets`); el uso real se verifica en sprint-05 task-04 (guardar/leer un secreto cifrado). Anotar ambos en `docs/tasks/sprint-infra/task-09.md` y pasarla a `en curso` hasta entonces.

### Task 3 — infra-05: SMTP del proyecto

**Files:**
- Modify: `docs/infrastructure.md` (fila SMTP: proveedor, remitente, dominio — sin credenciales)

**Interfaces:**
- Produces: custom SMTP configurado en el proyecto `027apps-dev`; lo consume sprint-05 task-02 (reset de contraseña / invitaciones).

- [ ] **Step 1: (usuario) Elegir proveedor y crear cuenta**

Recomendado **Resend** (3000/mes, 100/día, verificación de dominio con DKIM); alternativa Brevo (300/día). 2FA activa.

- [ ] **Step 2: (usuario) Verificar el dominio de envío**

En el proveedor: añadir el dominio y dar de alta los registros DNS que pida (SPF/DKIM). Alternativa mínima mientras no haya dominio: remitente verificado del proveedor (suficiente para desarrollo).

- [ ] **Step 3: (usuario) Configurar custom SMTP en Supabase**

Dashboard de `027apps-dev` → Authentication → SMTP: activar custom SMTP con host/puerto/usuario/contraseña del proveedor y remitente `noreply@<dominio>`. Las credenciales van solo ahí; nunca al repo.

- [ ] **Step 4: (usuario) Enviar el email de prueba de Supabase**

Run (Dashboard): botón **Send test email** de la plantilla.
Expected: llega al buzón del usuario (revisar spam la primera vez).

- [ ] **Step 5: (agente) Documentar y registrar**

`docs/infrastructure.md`: proveedor, remitente, fecha de verificación. `task-05.md` → `finalizada` con la evidencia. La prueba completa del flujo de reset queda para sprint-05 task-02.

### Task 4 — infra-06: Conectar Vercel (previews)

**Files:**
- Modify: `docs/flows/cicd.md` (estado de deploy: previews activos; producción en pausa con mecanismo real)
- Modify: `docs/tasks/sprint-infra/task-06.md`, `docs/infrastructure.md`

**Interfaces:**
- Produces: checks de Vercel en cada PR con URL de preview; proyecto con las 3 envs de Supabase (scope Preview y Production). Lo consume sprint-05 (aceptación en preview) y la tarea 2 (envs de la clave maestra).

- [ ] **Step 1: (usuario) Importar el repo**

vercel.com con la cuenta de GitHub (2FA): Add New Project → importar `rferic/027apps` → **Root Directory: `apps/admin`** → activar **"Include source files outside of the Root Directory"** (el workspace pnpm necesita ficheros de raíz) → Framework: Next.js (auto).

- [ ] **Step 2: (usuario) Producción en pausa real (desviación documentada)**

**Production Branch: `production`** (rama que no existe): los pushes a `main` generan solo previews. Se cambiará a `main` al cierre de sprint-05 (decisión de pausa del 2026-10-25, ahora con mecanismo en vez de disciplina). `cicd.md` se actualiza en el PR de esta tarea.

- [ ] **Step 3: (usuario) Env vars**

Añadir `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (scope **Preview** y **Production**), y `SETTINGS_ENCRYPTION_KEY` si la tarea 2 ya se hizo. Valores pegados por el usuario en el dashboard.

- [ ] **Step 4: (agente) Evidencia de preview**

Run: abrir (o reusar) un PR y `gh pr checks <n>` + `curl -s <preview-url>/api/health`
Expected: check `vercel` en verde con URL de preview; `/api/health` → `200 ok` (envs de Preview presentes).

- [ ] **Step 5: (agente) Documentar y cerrar**

`cicd.md` (tabla de pieza: "Vercel previews — implementado; producción en pausa: Production Branch `production`"), `task-06.md` → `finalizada`.

### Task 5 — infra-01: Proteger `main` (ruleset)

**Files:**
- Modify: `docs/tasks/sprint-infra/task-01.md` (evidencia)

**Interfaces:**
- Produces: ruleset de `main` activo (PR obligatorio, 4 checks requeridos, sin force-push/borrado). Lo exigen la tarea 8 (toggle de code owners) y la tarea 10 (antes del keystore).

- [ ] **Step 1: (usuario) Crear el ruleset de rama**

Settings → Rules → Rulesets → New branch ruleset, `main`, Enforcement **Active**: Require a pull request (approvals ≥ 1); Required status checks: `admin`, `android`, `guard-secrets`, `commitlint` (+ el de Vercel si ya está conectado); Block force pushes; Restrict deletions. Sin bypass para el propio owner (lo que se quiere evitar es el atajo).

- [ ] **Step 2: (agente) Evidencia roja: un push directo a `main` es rechazado**

Run:
```bash
git checkout -b tmp-direct-push main && git commit --allow-empty -m "test: direct push probe"
git push origin tmp-direct-push:main
git checkout orca-view && git branch -D tmp-direct-push
```
Expected: el push es **rechazado** por el ruleset (el commit es descendiente de `main`, así que el rechazo es del ruleset, no de un non-fast-forward). Guardar la salida en `task-01.md`.

- [ ] **Step 3: (agente) Evidencia de config**

Run: `gh api repos/rferic/027apps/rulesets --jq '.[] | {name, enforcement, ...}'`
Expected: el ruleset `main` aparece `active` con las reglas anteriores.

- [ ] **Step 4: (agente) Cerrar**

`task-01.md` → `finalizada` con ambas evidencias.

### Task 6 — infra-02: Ruleset de tags `v*`

**Files:**
- Modify: `docs/tasks/sprint-infra/task-02.md` (evidencia)

**Interfaces:**
- Produces: reglas de tags que impiden que un no-admin cree/mueva/borre `v*` — condición previa de la tarea 10.

- [ ] **Step 1: (usuario) Crear el ruleset de tags**

Settings → Rules → Rulesets → New tag ruleset: target **Tags**, patrón `v*`, Enforcement **Active**: Restrict creations, Restrict updates, Restrict deletions, con **Bypass list = Repository admin** (así el owner puede etiquetar y nadie más).

- [ ] **Step 2: (agente) Evidencia de config**

Run: `gh api repos/rferic/027apps/rulesets --jq '.[] | {name, enforcement, conditions, rules}'`
Expected: el ruleset de tags aparece `active`, target tags, patrón `v*`, con las tres restricciones y bypass de admin. (No se empuja ningún tag de prueba: un `v*` dispara el job `release`, que falla de forma intencionada sin keystore — ruido inútil; la config vía API es la evidencia.)

- [ ] **Step 3: (agente) Cerrar con nota honesta**

La denegación a un **no-admin** no se puede probar sin segunda cuenta — anotarlo como limitación en `task-02.md` y pasarla a `finalizada` con la config como evidencia principal.

### Task 7 — infra-08: Firebase + FCM (fase de provisionamiento)

**Files:**
- Modify: `docs/infrastructure.md` (fila Firebase: project id, app registrada, fecha; sin claves)

**Interfaces:**
- Produces: valores **públicos** de FCM recolectados (`fcm_project_id`, `fcm_app_id`, `fcm_api_key`, `fcm_sender_id`) + service account JSON guardado — los consume sprint-06 task-06 (settings `notifications.push` + envío HTTP v1).

- [ ] **Step 1: (usuario) Crear el proyecto y registrar la app Android**

console.firebase.google.com (cuenta Google, 2FA): proyecto gratuito → Project settings → Add app → Android → package **`com.rferic.zero27apps`** (exacto, `apps/android/app/build.gradle.kts:25`). Sin `google-services.json` en el repo: el APK se configura **en runtime** desde settings.

- [ ] **Step 2: (usuario) Recolectar los valores públicos**

Del `google-services.json` descargado (solo para copiar valores y archivarlo en el gestor de contraseñas): `project_id` → `fcm_project_id`, `mobilesdk_app_id` → `fcm_app_id`, `api_key.current_key` → `fcm_api_key`, `project_number` → `fcm_sender_id`. Se cargarán en settings cuando exista el wizard (sprint-06), no antes.

- [ ] **Step 3: (usuario) Service account para FCM HTTP v1**

Project settings → Service accounts → Generate new private key → guardar el JSON **cifrado en el gestor de contraseñas**. Nunca en git, logs ni chat (`guard-secrets` cubre bloques PEM, no JSON — no pegar el contenido en ningún sitio del repo).

- [ ] **Step 4: (agente) Registrar y cerrar la fase**

`docs/infrastructure.md`: proyecto Firebase, app registrada, fecha. `task-08.md` → `en curso` con nota: verificación E2E (push con app cerrada) diferida a sprint-06 task-06.

### Task 8 — infra-10: CODEOWNERS y propiedad de workflows

**Files:**
- Create: `.github/CODEOWNERS`
- Test: PR de prueba sobre `.github/workflows/ci.yml` (se cierra sin mergear)

**Interfaces:**
- Consumes: ruleset de `main` de la tarea 5 (para activar "Require review from Code Owners" sobre él).
- Produces: cualquier PR que toque workflows exige revisión del owner (checklist A06).

- [ ] **Step 1: (agente) Crear `.github/CODEOWNERS`**

```
# CI workflows can exfiltrate secrets: owner review is mandatory (T10/A06).
/.github/workflows/ @rferic
/.github/CODEOWNERS @rferic
```

- [ ] **Step 2: (usuario) Activar el toggle en el ruleset de `main`**

Edit del ruleset de la tarea 5 → activar **Require review from Code Owners**.

- [ ] **Step 3: (agente) Evidencia: PR que toca un workflow exige revisión**

Run: rama de prueba con un comentario en `ci.yml` → `gh pr create` → `gh pr view <n> --json reviewDecision,reviewRequests`
Expected: el PR muestra revisión requerida de `@rferic` antes de cualquier aprobación. Cerrar el PR sin mergear y guardar la salida en `task-10.md`.

- [ ] **Step 4: (agente) Commit y PR**

```bash
git add .github/CODEOWNERS docs/tasks/sprint-infra/task-10.md
git commit -m "ci(infra): protect workflow edits with code owners"
```

PR único con el fichero + evidencia; checklist A06 pasa de `✘` a `✔` en `docs/conventions/security-checklist.md` al merge.

### Task 9 — infra-11: Ampliar `guard-secrets` a los prefijos del proyecto

**Files:**
- Modify: `.github/workflows/ci.yml:71-78` (job `guard-secrets`, lista `-e` del `git grep` y regex de ficheros rastreados de la línea 62)
- Modify: `docs/flows/cicd.md` (fila `guard-secrets`), `docs/conventions/security-checklist.md` (A06)
- Test: fixture temporal con claves ficticias (rama de prueba, se retira)

**Interfaces:**
- Consumes: nada (job autocontenido).
- Produces: detección de `027_svc_…`, `027_usr_…`, `SETTINGS_ENCRYPTION_KEY=<valor>` y `google-services.json` rastreado. Lo citan el runbook y la checklist.

- [ ] **Step 1: (agente) Escribir los patrones nuevos (sin auto-coincidencia)**

Añadir al `git grep` (mismas clases de corchetes que el resto):
```yaml
-e '027_(svc|usr)_[A-Za-z0-9_-]{20,}' \
-e 'SETTINGS_ENCRYPTION_KEY[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9+/=]{20,}' \
```
y a la regex de ficheros rastreados: `|^google-services\.json$|` (config de app que nunca se hornea).

- [ ] **Step 2: (agente) Rojo local: el grep detecta el fixture**

Run: crear `/tmp/fixture` con `027_svc_AAAA…(24)`, `027_usr_BBBB…(24)`, `SETTINGS_ENCRYPTION_KEY=CCCC…(44 base64)` y replicar el `git grep` del job contra él (patrón a patrón).
Expected: cada patrón encuentra su línea. Iterar aquí, no en CI.

- [ ] **Step 3: (agente) Rojo en CI: fixture en rama → el job falla**

Commit del fixture (claves ficticias, prefijos reales) en rama `test/guard-secrets-fixture` → push → `gh run watch`
Expected: job `guard-secrets` **rojo** listando el fixture (solo nombres de fichero). Guardar el enlace del run.

- [ ] **Step 4: (agente) Verde: retirar el fixture → el job pasa**

Segundo commit que elimina el fixture → `gh pr checks`
Expected: `guard-secrets` verde (evidencia de ambos runs en `task-11.md`).

- [ ] **Step 5: (agente) Docs y PR**

Actualizar fila de `guard-secrets` en `cicd.md` y A06 en la checklist; PR `ci(infra): extend guard-secrets to project key prefixes`.

### Task 10 — infra-03: Environment `release` + keystore + secrets del APK

**Files:**
- Modify: `docs/tasks/sprint-infra/task-03.md` (evidencia)
- Local (nunca en git): `027apps-release.jks` (se destruye tras subir)

**Interfaces:**
- Consumes: reglas de `main` (tarea 5) y de tags (tarea 6) — **re-verificadas en el paso 1**.
- Produces: secrets de firma en el Environment `release`; los consume el job `release` de `ci.yml` en el primer tag real (cuando el Core sea funcional).

- [ ] **Step 1: (agente) Pre-verificación anti-exfiltración**

Run: `gh api repos/rferic/027apps/rulesets --jq '.[] | select(.enforcement=="active") | .conditions'`
Expected: ruleset de `main` y de tags `v*` activos. Si falta alguno, **parar**: no se sube ningún secret.

- [ ] **Step 2: (usuario) Environment `release`**

Settings → Environments → New environment `release`: Required reviewers = el propietario; Deployment branches and tags limitado a `v*` (opcional pero recomendado). El job `release` ya declara `environment: release`.

- [ ] **Step 3: (usuario) Generar el keystore y guardarlo**

Run (el usuario, en local, según `apps/android/keystore/README.md`):
```bash
keytool -genkeypair -v -keystore 027apps-release.jks -alias 027apps \
  -keyalg RSA -keysize 4096 -validity 10000
shasum -a 256 027apps-release.jks   # anotar el hash en el gestor
```
Guardar `.jks` + alias + ambas contraseñas en el gestor de contraseñas.

- [ ] **Step 4: (usuario) Verificar la copia ANTES de borrar el original**

Run (el usuario): extraer el `.jks` del gestor a otra ruta y `shasum -a 256`
Expected: mismo hash que el anotado. Solo entonces: `rm -P 027apps-release.jks` (borrado seguro) y vaciar papelera.

- [ ] **Step 5: (usuario) Subir los 4 secrets al Environment**

Run (el usuario, comandos de `cicd.md` §A.6): `gh secret set ANDROID_KEYSTORE_BASE64 --env release < <(base64 < …)` etc. para `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`--body 027apps`), `ANDROID_KEY_PASSWORD`.

- [ ] **Step 6: (agente) Verificación de presencia y cierre**

Run: `gh secret list --env release -R rferic/027apps` y `gh pr checks` (o CI del PR en curso)
Expected: los 4 nombres listados (nunca valores); `guard-secrets` verde (ningún `.jks` rastreado). `task-03.md` → `finalizada`.

### Task 11 — infra-07: `PROD_URL` para keep-alive (opcional; bloqueada por producción)

**Files:**
- Modify: `docs/tasks/sprint-infra/task-07.md` (evidencia)

**Interfaces:**
- Consumes: URL de producción real (existe al cierre de sprint-05, tras activar Production Branch `main`).
- Produces: keep-alive diario activo.

- [ ] **Step 1: (usuario) Subir el secret**

Run (el usuario): `gh secret set PROD_URL -R rferic/027apps` (pega la URL en el prompt).

- [ ] **Step 2: (agente) Evidencia**

Run: `gh workflow run keep-alive.yml && gh run watch`
Expected: run verde con el ping registrado (y el job sigue omitiendo el ping en forks sin `PROD_URL` — condición ya implementada). `task-07.md` → `finalizada`.

### Task 12 — infra-12: Backup cifrado — activación y primer simulacro

**Files:**
- Modify: `docs/infrastructure.md` (activación + fecha del primer simulacro), `docs/flows/cicd.md` (estado de la fila backup)
- Modify: `docs/tasks/sprint-infra/task-12.md` (evidencia)

**Interfaces:**
- Consumes: BD de producción con datos (proyecto `027apps-prod`, creado al cierre de sprint-05) — sin prod no hay qué respaldar.
- Produces: snapshot diario restaurable fuera de Supabase; recuperación probada.

- [ ] **Step 1: (usuario) Bucket + token + `RESTIC_PASSWORD`**

Crear bucket privado en Cloudflare R2 o Backblaze B2; token S3 con alcance **solo a ese bucket**; `RESTIC_PASSWORD` generado y guardado en el gestor **y en papel** (sin papel, un solo fallo del gestor = backup irrecuperable). Comandos y detalles: `docs/infrastructure.md` paso C.

- [ ] **Step 2: (usuario) Secrets del backup**

Run (el usuario): `gh secret set SUPABASE_DB_URL` (cadena del **session pooler**, puerto 5432, del proyecto prod), `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; variable `BACKUP_S3_REGION=auto` si es R2; opcional `HEALTHCHECK_URL`.

- [ ] **Step 3: (agente) Primer backup real**

Run: `gh workflow run backup.yml && gh run watch`
Expected: run verde con TOC validado y `restic check` limpio en el log (sin secretos impresos).

- [ ] **Step 4: (agente) Simulacro de restauración (la prueba que importa)**

Run: `docker run -d --name restore-drill -e POSTGRES_PASSWORD=drill postgres:17` → `scripts/backup/restore.sh` contra esa instancia (snapshot más reciente, `--schema public`) → verificar 3 filas de tablas conocidas con `psql`.
Expected: filas idénticas a prod. Anotar fecha y resultado en `docs/infrastructure.md`.

- [ ] **Step 5: (agente) Cerrar**

`cicd.md`: fila backup → activado. `task-12.md` → `finalizada` con enlaces de runs. Calendarizar el simulacro trimestral (nota en runbook).

---

## Cierre del sprint

1. Cada `task-NN.md` con estado final (`finalizada`/`en curso` con bloqueo documentado) y evidencia enlazada; `README.md` del sprint actualizado.
2. Auditoría de seguridad de los dos PRs de repo (CODEOWNERS, guard-secrets): permisos, patrones sin auto-coincidencia, sin `pull_request_target`, secretos por paso.
3. `pnpm lint && pnpm tsc && pnpm test` en verde; CI del PR en verde.
4. `docs/flows/cicd.md` refleja el estado real tras el sprint (tabla de piezas y secretos).
5. Merge a `main` solo con orden explícita del usuario.

## Riesgos y notas

- **Proyecto dev idle** → Supabase pausa los proyectos free tras ~1 semana de inactividad; la pausa conserva los datos y el proyecto se restaura a mano desde el dashboard. Si molesta, alternar uso ligero o aceptar el restore manual.
- **Un solo administrador**: las reglas "solo admins" no se pueden probar negativamente sin segunda cuenta; se deja anotado (tarea 6).
- **Vercel Production Branch placeholder**: al cierre de sprint-05 hay que **recordar** cambiarlo a `main` (nota en `docs/tasks/sprint-05-core-base/README.md`).
- **El release real** (tag → APK firmado → instalación) se verifica cuando el Core sea funcional; la tarea 10 solo garantiza que el mecanismo está listo.
