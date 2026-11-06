---
id: sprint-04-task-06
titulo: Conectar Vercel (previews)
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-sprint-04-infra.md
fuente: docs/flows/cicd.md §B
---

**Tarea**: crear la cuenta Vercel, importar el repo `rferic/027apps` (Root Directory `apps/admin`), activar "Include source files outside of the Root Directory", configurar env vars, *Production Branch:* `production` (placeholder congelado en el HEAD de `main`; Vercel exige que exista en el repo). Previews por PR sí; **producción en pausa** hasta que exista core funcional (decisión 2026-10-25). Al cierre de sprint-08-core-base se cambia a `main`. Puerta de setup del usuario.

## Bitácora (2026-10-31)

- **Cuenta Vercel** creada: `rferic` (Eric RF), plan Hobby, team `eric-rf`. El MCP de Vercel quedó autorizado sobre el team.
- **Proyecto legacy `027apps`** borrado por el usuario en el dashboard (decisión reset 2026-10-27), y recreado desde el repo por API:
  `027apps` (`prj_tYO9nHAactnHPQL6LtAzkw4RAPBM`), conectado a GitHub `rferic/027apps`.
- **Configuración** (verificada por API): Root Directory `apps/admin`, con ficheros de la raíz incluidos (workspace pnpm); framework Next.js; Node 26.x; Vercel Authentication activa en todos los deployments menos dominios custom.
- **Production Branch**: `production` (placeholder, no existe → producción en pausa hasta que exista el Core funcional; decisión 2026-10-25). El agente lo dejó en `main` por API (la API no permite cambiarlo por PATCH). La rama `production` se creó en GitHub congelada en el HEAD de `main` (`a2c9a84`) porque Vercel rechaza ramas inexistentes; no se toca hasta el cierre de sprint-08-core-base, cuando se cambia el tracking a `main`.
- **Env vars** (4, scope Preview, verificadas por API por nombre; nunca valores):
  - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publicas por diseño): creadas por el agente por API (tipo plain).
  - `SUPABASE_SERVICE_ROLE_KEY` y `SETTINGS_ENCRYPTION_KEY`: creadas por el agente por API (tipo **sensitive**), leyendo los valores desde ficheros locales (API de Supabase y `apps/admin/.env.local`) y borrando los ficheros temporales. Los valores nunca pasaron por el chat.
- **Primer deploy**: READY (`dpl_Dr9fcbXfkNzPLyKWbnuTaVeTQSc6`, commit `1223511` del PR #29), marcado `target: production` con la rama de producción por defecto. Tras fijar *Production Branch* = `production` (2026-10-31), los pushes posteriores (`1b265eb`, `8436216`) son **previews READY**; el deploy antiguo quedó sin dominio (dominios del proyecto: ninguno). Las env vars de scope Production están vacías a propósito hasta que exista `027apps-prod`. Los previews están detrás de *Vercel Authentication*: la verificación de `/api/health` se hace desde el dashboard con la sesión del team (curl anónimo redirige al login).
- **Production scope** de las env vars: cuando exista `027apps-prod` (cierre de sprint-08-core-base).
