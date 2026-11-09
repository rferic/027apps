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

**Contexto**: Supabase Free permite 2 proyectos activos; hoy solo existe `027apps-dev` (ref
`wrigkwhrihawvwiciouy`). Hay 19 migraciones (`0001`–`0019`). La clave maestra
`SETTINGS_ENCRYPTION_KEY` de prod es **nueva** (instancias separadas, sin secretos compartidos).

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
