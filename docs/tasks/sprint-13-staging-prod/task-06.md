---
id: sprint-13-task-06
titulo: Entorno de producción completo (crear)
area: infra
estado: pendiente
plan: docs/superpowers/plans/2026-11-08-staging-production.md
fuente: docs/superpowers/specs/2026-11-08-staging-production-design.md §B
adrs: [0010]
---

**Tarea**: crear de cero el entorno de producción, según la checklist §B de la spec.

**Objetivo**: `027apps-prod` operativo con variables de producción, Auth + SMTP (Resend),
migraciones aplicadas, y Vercel Production apuntando a `main`.

**Contexto**: Supabase Free permite 2 proyectos activos. `027apps-dev` es
`wrigkwhrihawvwiciouy` y `027apps-prod` se creó el 2026-11-09 con ref
**`pmsxqwcvsvtiipgfgwdt`** (contraseña en el gestor del propietario; no consta en el repo). Hay
19 migraciones (`0001`–`0019`). La clave maestra `SETTINGS_ENCRYPTION_KEY` de prod es **nueva**
(instancias separadas, sin secretos compartidos).

**Alcance** (§B de la spec):
- Dentro: crear `027apps-prod` (eu-west, contraseña en dashboard), ref anotado en
  `docs/infrastructure.md`, migraciones `0001`–`0019` aplicadas y verificadas; Auth (site URL
  `https://027apps.ericrf.com`, redirect URLs, SMTP Resend, límites); Storage/Realtime
  replicados de dev solo lo que exista (verificación pendiente, no inventar); Vercel
  Production (5 variables de prod, `SUPABASE_SERVICE_ROLE_KEY` y `SETTINGS_ENCRYPTION_KEY`
  sensitive, *Production Branch* = `main`, dominio `027apps.ericrf.com`, borrar rama
  `production`); GitHub (Environment `production`, `SUPABASE_ACCESS_TOKEN`, `PROD_URL`,
  secretos del backup); verificación end-to-end; operación (keep-alive, alerta de backup,
  reactivación si pausa).
- Fuera: backup (tarea 07) y keep-alive/runbook (tarea 08).

**Criterios de aceptación**:
- `027apps-prod` con migraciones `0001`–`0019` aplicadas (verificado con
  `supabase migration list --linked`) y SMTP funcional.
- `/api/health` en verde; wizard de instalación, invitación y reset probados.
- Vercel Production con *Production Branch* = `main`, dominio `027apps.ericrf.com` y variables
  de prod correctas; rama `production` borrada.
- `SETTINGS_ENCRYPTION_KEY` de prod nueva (no reutilizada de dev), documentado.
- Environment `production` de GitHub con required reviewer configurado.

**Puertas de usuario**: crear `027apps-prod` (Supabase); *Production Branch*, dominio y
variables (Vercel); Environment `production` y `SUPABASE_ACCESS_TOKEN` (GitHub); SMTP (Resend).

**Riesgos**: reutilizar el proyecto dev como prod; reutilizar la clave maestra de dev; no
verificar el nivel de migraciones antes de abrir producción (las `0015`–`0019` cierran una
escalada de privilegios y deben aplicarse antes de exponer prod).

## Ejecución (2026-11-09) — paso 0: poner `027apps-dev` al día

Antes de crear prod se verificó el nivel de migraciones de dev y estaba **en `0013`** (13 filas
en `supabase_migrations.schema_migrations`), con dos problemas añadidos:

1. Las 6 últimas (`0014`–`0019`) están en `main` desde el PR #42 y **nunca se aplicaron** a la
   nube: el workflow `migrations.yml` no ha corrido (no hay secrets de GitHub).
2. Las 13 filas tenían **version = timestamp** (`20261103074037`, …), porque se aplicaron con
   `apply_migration` y no con `supabase db push`. Con local `0001…0019` y remoto `2026…`, el
   CLI de Supabase falla al comparar (*"inserted before the last migration on remote"*), así
   que el job `migrate-dev` de la tarea 04 habría fallado en su primer run real.

Intervención (datos de prueba, sin usuarios reales):

- Comprobación previa: 0 filas que violen los constraints de `0014`; 1 fila `instance.logo_url`
  que elimina `0017`.
- `0014`–`0019` aplicadas por SQL transaccional (una transacción por migración) con su fila en
  `schema_migrations`.
- Versiones normalizadas a `0001`–`0019` con los nombres del CLI, para que `db push` y el
  workflow de migraciones funcionen. Snapshot del estado anterior guardado fuera del repo
  (`schema_migrations_dev_pre_normalize.json` en el temporal de la sesión).
- Verificado después: 19 filas; `anon` ya no puede insertar en `profiles`;
  `authenticated` solo actualiza `display_name`/`locale`/`timezone` (no `role` ni
  `deactivated_at`); `api_keys` sin escritura para `authenticated` y con solo
  `api_keys_select`; `created_by` nullable; `settings.instance.logo_url` a 0.

**Residual anotado para la auditoría de seguridad**: `pg_default_acl` del rol
**`supabase_admin`** sigue concediendo `EXECUTE` a `anon`/`authenticated` para funciones que cree
ese rol; `0019` solo revoca los default privileges de `postgres`. No bloquea (las migraciones
por CLI corren como `postgres`), pero merece una migración que lo cierre.

**Siguiente**: crear `027apps-prod` y aplicar `0001`–`0019` con `db push` (versiones quedarán ya
en el formato del repo).

## Ejecución (2026-11-09) — proyecto de producción y migraciones

- **Proyecto creado** por el propietario: `027apps-prod`, ref `pmsxqwcvsvtiipgfgwdt`, estado
  `ACTIVE_HEALTHY`, región **`eu-west-2`** (dev está en `eu-west-3`; la spec solo pide eu-west).
  Contraseña generada en el dashboard y guardada en el gestor; no consta en el repo.
- **Migraciones aplicadas con `db push`** (formato de versión correcto desde el inicio):
  `SUPABASE_DB_PASSWORD=… supabase link --project-ref pmsxqwcvsvtiipgfgwdt` +
  `supabase db push --linked --yes`. Salida: `Applying migration 0001…0019` →
  `Finished supabase db push`.
- **Verificación con `migration list --linked`**: `0001`–`0019` con Local = Remote, sin
  pendientes.
- **Verificación por SQL contra prod**: 19 tablas en `public`; 19 filas en
  `supabase_migrations.schema_migrations`; `anon` no puede insertar en `profiles`;
  `authenticated` no puede actualizar `profiles` a nivel de tabla pero sí
  `display_name`/`locale`/`timezone`; `authenticated` no puede insertar en `api_keys`;
  `api_keys.created_by` nullable; `settings.instance.logo_url` a 0.
- **Aviso no bloqueante**: al terminar, el CLI intenta cachear el catálogo de migraciones en
  `supabase/.temp/pgdelta` y falla por un certificado ausente. No afecta a las migraciones; el
  estado aplicado es el verificado arriba.
- La contraseña temporal usada para el `db push` se borró del disco y se eliminó el enlace local
  (`supabase/.temp/linked-project.json`) para que un `db push --linked` posterior no apunte a
  producción por accidente. Para volver a enlazar, `supabase link --project-ref
  pmsxqwcvsvtiipgfgwdt` (pide la contraseña del gestor).
- **GitHub**: Environments verificados por API. `production` tiene *required reviewer* (1) y
  *Deployment branches* = `main`; `staging` está limitado a `staging`. Variable
  `SUPABASE_PROJECT_REF` de `production` creada con el ref de prod
  (`pmsxqwcvsvtiipgfgwdt`). Cargado `SUPABASE_ACCESS_TOKEN` en `staging` y `production`; falta
  `SUPABASE_DB_PASSWORD` en ambos (verificado que es necesario: sin él `db push` se queda en el
  prompt de contraseña aunque haya token).
