# Spec: entornos `staging` y `main` con deploy automático

- **Fecha:** 2026-11-08 (revisión 2026-11-09)
- **Estado:** aprobada por el usuario el 2026-11-09
- **Ámbito:** modelo de entornos, ramas desplegables, CI en dos entornos, migraciones por
  entorno, configuración de Vercel y Supabase, backup y keep-alive de producción
- **Relacionado:** [ADR 0010](../../adr/0010-entornos-y-ramas.md) ·
  [`docs/flows/cicd.md`](../../flows/cicd.md) · [`docs/flows/git.md`](../../flows/git.md) ·
  [`docs/flows/release.md`](../../flows/release.md) ·
  [`docs/infrastructure.md`](../../infrastructure.md)

## 1. Objetivo

Activar un entorno de producción real y un entorno de *staging* intermedio, con **deploy
automático al mergear**, para que la instancia familiar pruebe los cambios antes de servirlos
a la familia, sin pasos manuales propensos a error.

**No objetivos (este sprint):** multi-tenant, auto-hosting de terceros, planes de pago de
Vercel/Supabase, entornos custom de Vercel (Pro), Supabase Branching (Pro+).

## 2. Estado actual verificado

- **Vercel Hobby**, proyecto `027apps`, *Production Branch* = `production` (placeholder
  congelado), dominio de producción eliminado, env vars solo con scope Preview
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SETTINGS_ENCRYPTION_KEY`, `SUPABASE_DB_URL`). Vercel Authentication activa en URLs de
  deployment, **no** en dominios custom. No hay `vercel.json`/`vercel.ts` (la configuración
  vive en el dashboard).
- **Supabase Free**: un solo proyecto `027apps-dev` (ref `wrigkwhrihawvwiciouy`, eu-west).
  *Branching* requiere Pro+. No existe `027apps-prod`. Hay 19 migraciones (`0001`–`0019`) en
  `supabase/migrations/`.
- **CI**: `.github/workflows/ci.yml` con jobs `admin`, `android`, `supabase`, `guard-secrets`,
  `commitlint`, `ai-docs`, `release`. Triggers: `pull_request`, `push` a `main`, tags `v*`.
  **No hay job de migraciones.** `keep-alive.yml` y `backup.yml` son diarios y están inactivos
  sin sus secrets.
- **Docs**: `cicd.md` describe deploy solo desde `main` y la pausa por falta de Core;
  `infrastructure.md` §9 tiene la checklist de activación (su paso 3: cambiar *Production
  Branch* a `main` y borrar `production`); `git.md` fija un sprint = un concepto, un PR por
  sprint, squash a `main`.
- **Sprint-11 absorbido**: `task-01` (keep-alive `PROD_URL`) y `task-02` (backup cifrado) se
  trasladan a este sprint contra `027apps-prod`.
- **Contradicciones de docs a resolver**: `git.md` (squash directo a `main`), `AGENTS.md` (un
  PR por sprint a `main`), `cicd.md` (deploy solo desde `main` y la pausa por falta de Core),
  `release.md` (cada merge a `main` despliega, sin paso por `staging`) e `infrastructure.md` §9
  (activación «al cierre de sprint-08-core-base») describen aún el modelo anterior. **Se
  resuelven todas en la tarea 01** de este sprint, que alinea esos ficheros con este documento;
  ninguna queda abierta fuera de esa tarea.

## 3. Modelo de entornos

| Rama | Vercel | Dominio | Supabase | Deploy |
|---|---|---|---|---|
| `sprint/*`, `fix/*` (PR) | Preview | URL del deployment | `027apps-dev` | automático |
| `staging` | Preview con variables por rama | `staging.027apps.ericrf.com` | `027apps-dev` | automático al mergear |
| `main` | Production | `027apps.ericrf.com` | `027apps-prod` | automático al mergear |

- `main` es producción. No hay `develop`. La rama placeholder `production` se elimina.
- `staging` es una rama de larga vida asignada al entorno Preview con dominio y variables
  propias; recibe los merges de las ramas de trabajo y se sincroniza desde `main` tras cada
  release.
- `027apps-dev` lo comparten los previews de PR y `staging` (datos de desarrollo, no reales).
  `027apps-prod` es exclusivo de `main`.
- **`staging.027apps.ericrf.com` queda protegido** (decisión del usuario, 2026-11-09): la
  familia **no** podrá acceder a staging en Hobby; lo prueba el propietario y los agentes usan
  *Protection Bypass for Automation* si hace falta. Detalle en §A.5 y §B.

## 4. Flujo de promoción

1. Rama de trabajo (`sprint/*`, `fix/*`, `chore/*`) desde `main` actualizado (o desde
   `staging` si se encadena), con su PR en draft contra `staging`.
2. CI corre los gates en cada push al PR; Vercel despliega un preview.
3. Merge a `staging` (PR obligatorio, checks en verde) → deploy automático a
   `staging.027apps.ericrf.com` y migraciones a `027apps-dev`.
4. Pruebas sobre staging (login, datos de prueba, `/api/health`) por el propietario o por un
   agente con *Protection Bypass for Automation*.
5. PR `staging → main` (checks en verde, aprobación) → deploy automático a producción y
   migraciones a `027apps-prod` tras la aprobación del *required reviewer*.
6. Tras el release, sincronizar `main → staging` (merge) para que `staging` no diverja.

## A. Entorno de preview (existente — se edita)

Checklist de lo que se modifica sobre el entorno que ya existe. Todo es **edición** sobre
Vercel Preview y `027apps-dev`; no se crea nada de producción aquí (eso es §B).

- [ ] **A.1 Vercel Preview — variables.** Las 5 variables con scope **Preview** en **todas las
  ramas**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SETTINGS_ENCRYPTION_KEY`, `SUPABASE_DB_URL`. Comprobar que no
  queda ninguna con scope limitado a una rama concreta (`SUPABASE_DB_URL` ya se amplió a todas
  las ramas de Preview el 2026-11-08).
- [ ] **A.2 `027apps-dev` — contraseña de BD.** Rotar la contraseña (se compartió por chat el
  2026-10-27). Actualizar `SUPABASE_DB_URL` en Vercel Preview y en `.env.local` (nunca en
  git; `.env.local` está en `.gitignore`).
- [ ] **A.3 `027apps-dev` — Auth.** Site URL y redirect URLs que cubran `http://027apps.local`,
  el puerto local (`http://localhost:3003`, `http://127.0.0.1:3003`) y
  `https://staging.027apps.ericrf.com` (añadir este último a los tres que ya existen en
  `supabase/config.toml`).
- [ ] **A.4 Nueva rama `staging` en Vercel.** Branch tracking en Preview, dominio
  `staging.027apps.ericrf.com` asignado a la rama, y variables por rama. **Decisión
  documentada:** `staging` **hereda las variables de Preview** (apuntan a `027apps-dev`); no se
  duplican porque staging comparte la misma BD de desarrollo y no hay valores propios de
  staging que justifiquen un segundo juego de variables.
- [ ] **A.5 Deployment Protection del proyecto.** Alcance: **Standard Protection** (protege
  todo **excepto los dominios de producción**). Queda protegido: los previews y `staging`.
  Sigue público: `027apps.ericrf.com` (producción). **No** usar *All Deployments*: protegería
  también `027apps.ericrf.com` y dejaría a la familia fuera.
- [ ] **A.6 Verificación.** Un PR cualquiera y un push a `staging` despliegan; `/api/health`
  responde `ok` en staging; el preview sigue apuntando a `027apps-dev`.

## B. Entorno de producción (se crea de cero — checklist completa)

Checklist de lo que se crea para producción. Cada ítem es **nuevo**; nada de esto existe hoy.

- [ ] **B.1 Supabase `027apps-prod`.** Creación (región eu-west), contraseña generada en el
  dashboard (nunca por chat ni en git), project ref anotado en `docs/infrastructure.md`,
  migraciones `0001`–`0019` aplicadas y verificadas con `supabase migration list --linked`, y
  suite RLS contra prod **o** justificación por escrito de por qué no (la suite RLS corre en
  el stack local vía `supabase start`; si no se ejecuta contra prod, justificar la equivalencia).
- [ ] **B.2 Auth de `027apps-prod`.** Site URL `https://027apps.ericrf.com`; redirect URLs de
  invitación y reset; SMTP Resend (`mail.ericrf.com`); límites de Auth (30 mensajes/hora
  ajustables en *Authentication → Rate Limits*).
- [ ] **B.3 Storage / Realtime del proyecto.** **Verificación pendiente:** no hay buckets de
  Storage documentados ni configurados en el repo (el bloque `[storage.buckets]` de
  `supabase/config.toml` está comentado y la app no usa buckets). Realtime está habilitado por
  defecto y sus políticas viven en las migraciones (`0012`, `0019`), así que no hay ajuste de
  dashboard que replicar. **Replicar de dev solo lo que se detecte al inspeccionar el dashboard
  de `027apps-dev`; no inventar buckets.**
- [ ] **B.4 Vercel Production.** Las 5 variables con valores de prod
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SETTINGS_ENCRYPTION_KEY`, `SUPABASE_DB_URL`); `SUPABASE_SERVICE_ROLE_KEY` y
  `SETTINGS_ENCRYPTION_KEY` tipo *sensitive*. **Decisión documentada:** la clave maestra
  `SETTINGS_ENCRYPTION_KEY` es **nueva** (distinta de la de dev) — son instancias separadas y no
  se comparte ningún secreto entre dev y prod; el wizard de instalación fija la de prod en su
  primer arranque. *Production Branch* = `main`; dominio `027apps.ericrf.com` + DNS en Vercel;
  borrado de la rama placeholder `production`.
- [ ] **B.5 GitHub.** Environment `production` con *required reviewer*;
  `SUPABASE_ACCESS_TOKEN` (scope mínimo, proyecto prod) para el job de migraciones; `PROD_URL`;
  secretos del backup (`SUPABASE_DB_URL`, `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`,
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) apuntando a la BD de prod.
- [ ] **B.6 Verificación end-to-end de producción.** `/api/health`, wizard de instalación,
  login por invitación, reset de contraseña, primer backup y simulacro de restauración.
- [ ] **B.7 Operación.** Keep-alive activo; alerta de fallo de backup (email de GitHub +
  healthchecks.io); y qué hacer si Supabase pausa el proyecto por inactividad (el keep-alive lo
  evita; si aun así pausa, reactivar y restaurar desde backup según
  `docs/infrastructure.md` §5).

## 5. Política de migraciones por entorno

- `staging` (merge) → job aplica migraciones a `027apps-dev` (sin aprobación: son datos de
  desarrollo).
- `main` (merge) → job aplica migraciones a `027apps-prod`, protegido por el Environment
  `production` con *required reviewer*: **el usuario aprueba antes de tocar datos reales**.
- Antes de una migración destructiva: verificar el nivel de migraciones
  (`supabase migration list --linked`) y lanzar un backup manual (`workflow_dispatch`).
- Migraciones compatibles hacia atrás (expand → migrate → contract): el admin nuevo ya está
  desplegado cuando se aplica la migración y un rollback de código sigue funcionando.

## 6. Secretos y scopes por entorno

| Nombre | Dónde | Entorno | Uso |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Preview y Production | URL y clave anon públicas por diseño |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Preview y Production | Clave de servicio (sensitive, nunca `NEXT_PUBLIC_`) |
| `SETTINGS_ENCRYPTION_KEY` | Vercel | Preview y Production | Clave maestra de cifrado de settings (sensitive; distinta por entorno) |
| `SUPABASE_DB_URL` | Vercel | Preview y Production | Conexión directa Postgres del Core |
| `SUPABASE_DB_URL` | GitHub Secrets | backup | Conexión a `027apps-prod` (session pooler, IPv4) para `pg_dump` |
| `SUPABASE_ACCESS_TOKEN` | GitHub Secrets | migraciones | Token de scope mínimo para `supabase db push` |
| `PROD_URL` | GitHub Secrets | keep-alive | URL base de producción |
| `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | GitHub Secrets | backup | Repo restic y credenciales S3 |
| `ANDROID_KEYSTORE_*` | GitHub Secrets (Environment `release`) | release | Firma del APK (sin cambios) |

Reglas: secretos solo en Vercel / GitHub Secrets / gestor de contraseñas; nunca en git. Los
secretos se inyectan por paso. El project ref de producción se cita por nombre hasta que
exista (se crea en la tarea 06); no se inventa ningún valor.

## 7. Protección de ramas y checks requeridos

- `main` y `staging` protegidas: PR obligatorio, sin commits directos, sin force-push ni
  borrado.
- Checks requeridos en ambas: `admin`, `android`, `supabase`, `guard-secrets`, `commitlint`,
  `ai-docs` y el check de Vercel.
- `main` además exige aprobación del propietario y el *required reviewer* del Environment
  `production` para las migraciones.

## 8. Releases y tags

- Tag `vX.Y.Z` sobre `main` = release. CI firma y publica el APK (job `release`), y es el
  momento en que otras familias autoalojadas despliegan.
- Tras cada release: merge `main → staging`.

## 9. Rollback

- **Código**: `git revert <sha>` del commit en `main` (o `staging`) → PR → gates → Vercel
  redespliega. Emergencia: promover en Vercel el deployment anterior y reconciliar después con
  `git revert` (la fuente de verdad sigue siendo git).
- **Migraciones**: no se revierten con `git revert`; se corrige hacia delante con una
  migración nueva (por eso son compatibles hacia atrás).

## 10. Riesgos

- **Rama `staging` larga**: puede divergir de `main`; se mitiga con el merge `main → staging`
  tras cada release.
- **Datos compartidos en `027apps-dev`** entre previews de PR y `staging`: dos previews pueden
  pisarse; aceptado por ser datos de desarrollo.
- **Contraseña de `027apps-dev`** compartida por chat (2026-10-27): rotar en §A.2.
- **Staging protegido**: la familia no podrá probar staging en Hobby (decisión aceptada,
  2026-11-09); el propietario lo prueba y los agentes usan *Protection Bypass for Automation*.
- **Job de migraciones de prod** con acceso a datos reales: mitigado por el *required reviewer*
  y el backup previo.
- **Dominio de staging sin protección**: si *Standard Protection* no cubre el dominio custom
  asignado a la rama Preview, se aplica el plan B de §A.5 (no asignar dominio custom y usar la
  URL fija de rama).

## 11. Criterios de aceptación (verificables)

1. ADR 0010 y esta spec aprobados por el usuario y registrados.
2. `cicd.md`, `git.md`, `release.md`, `infrastructure.md` y `AGENTS.md` describen el modelo de
   dos ramas sin contradecirlo (contradicciones resueltas en la tarea 01).
3. `main` y `staging` protegidas con los checks requeridos; la rama `production` borrada.
4. Preview: las 5 variables con scope Preview en todas las ramas; `027apps-dev` con contraseña
   rotada y Auth cubriendo `027apps.local`, el puerto local y `staging.027apps.ericrf.com`.
5. `staging` despliega a `staging.027apps.ericrf.com` (protegido) y migra `027apps-dev`;
   `/api/health` responde `ok`.
6. `main` despliega a `027apps.ericrf.com` y migra `027apps-prod` solo tras aprobación.
7. Existe `027apps-prod` con migraciones `0001`–`0019` aplicadas y SMTP (Resend); login por
   invitación y reset de contraseña probados.
8. Primer backup cifrado y simulacro de restauración contra `027apps-prod`.
9. `PROD_URL` activa el keep-alive; runbook de promoción/rollback documentado.
10. Auditoría de seguridad superada.

## 12. Puertas de usuario

| Puerta | Qué decide/ejecuta el usuario | Tarea |
|---|---|---|
| Protección de ramas y rulesets | Acción de administrador en GitHub (no automatizable) | 02 |
| Environment `production` con required reviewer | Configura en GitHub | 04 |
| Rotar contraseña de `027apps-dev` y actualizar `SUPABASE_DB_URL` | Solo él puede (dashboard Supabase + Vercel + `.env.local`) | 05 |
| Asignar dominio `staging.027apps.ericrf.com` y Deployment Protection | Configura en Vercel (dashboard); **staging queda protegido** (decisión 2026-11-09) | 05 |
| Crear `027apps-prod`, *Production Branch* = `main`, borrar `production`, dominio y variables de prod | Solo él puede (Supabase/Vercel/GitHub) | 06 |
| Bucket + secrets del backup | Solo él puede | 07 |
| `PROD_URL` y aprobación del primer release | Subir secret + aprobar merge a `main` | 08 |
