# Spec: entornos `staging` y `main` con deploy automático

- **Fecha:** 2026-11-08
- **Estado:** propuesta aprobada para implementación (sprint-13-staging-prod)
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
  *Branching* requiere Pro+. No existe `027apps-prod`.
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

## 4. Flujo de promoción

1. Rama de trabajo (`sprint/*`, `fix/*`, `chore/*`) desde `main` actualizado (o desde
   `staging` si se encadena), con su PR en draft contra `staging`.
2. CI corre los gates en cada push al PR; Vercel despliega un preview.
3. Merge a `staging` (PR obligatorio, checks en verde) → deploy automático a
   `staging.027apps.ericrf.com` y migraciones a `027apps-dev`.
4. Pruebas sobre staging (login, datos de prueba, `/api/health`).
5. PR `staging → main` (checks en verde, aprobación) → deploy automático a producción y
   migraciones a `027apps-prod` tras la aprobación del *required reviewer*.
6. Tras el release, sincronizar `main → staging` (merge) para que `staging` no diverja.

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
| `SETTINGS_ENCRYPTION_KEY` | Vercel | Preview y Production | Clave maestra de cifrado de settings (sensitive) |
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
- **Contraseña de `027apps-dev`** compartida por chat (2026-10-27): rotar al crear prod.
- **Staging público** si se asigna dominio custom sin protección: pendiente de decisión (§12).
- **Job de migraciones de prod** con acceso a datos reales: mitigado por el *required reviewer*
  y el backup previo.

## 11. Criterios de aceptación (verificables)

1. ADR 0010 y esta spec aprobados y registrados.
2. `cicd.md`, `git.md`, `release.md`, `infrastructure.md` y `AGENTS.md` describen el modelo de
   dos ramas sin contradecirlo.
3. `main` y `staging` protegidas con los checks requeridos; la rama `production` borrada.
4. Un merge a `staging` despliega a `staging.027apps.ericrf.com` y migra `027apps-dev`.
5. Un merge a `main` despliega a `027apps.ericrf.com` y migra `027apps-prod` solo tras
   aprobación.
6. Existe `027apps-prod` con SMTP (Resend) y login por invitación + reset probados.
7. Primer backup cifrado y simulacro de restauración contra `027apps-prod`.
8. `PROD_URL` activa el keep-alive; runbook de promoción/rollback documentado.
9. Auditoría de seguridad superada.

## 12. Puertas de usuario

| Puerta | Qué decide/ejecuta el usuario | Tarea |
|---|---|---|
| Protección de ramas y rulesets | Acción de administrador en GitHub (no automatizable) | 02 |
| Environment `production` con required reviewer | Configura en GitHub | 04 |
| *Production Branch* = `main`, borrar `production`, dominio y variables | Configura en Vercel (dashboard) | 05 |
| **Staging público o protegido** | **Decisión pendiente**: dejar `staging.027apps.ericrf.com` público con el login normal de la app, o aplicarle Deployment Protection | 05 |
| Crear `027apps-prod` + SMTP + rotar contraseña dev | Solo él puede (dashboard Supabase/Resend) | 06 |
| Bucket + secrets del backup | Solo él puede | 07 |
| `PROD_URL` y aprobación del primer release | Subir secret + aprobar merge a `main` | 08 |
