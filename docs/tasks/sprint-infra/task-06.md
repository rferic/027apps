---
id: sprint-infra-task-06
titulo: Conectar Vercel (previews)
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: docs/flows/cicd.md §B
---

**Tarea**: crear la cuenta Vercel, importar el repo `rferic/027apps` (Root Directory `apps/admin`), activar "Include source files outside of the Root Directory", configurar env vars, *Production Branch:* `main`. Previews por PR sí; **producción en pausa** hasta que exista core funcional (decisión 2026-10-25). Puerta de setup del usuario.

## Bitácora (2026-10-31)

- **Cuenta Vercel** creada: `rferic` (Eric RF), plan Hobby, team `eric-rf`. El MCP de Vercel quedó autorizado sobre el team.
- **Proyecto legacy `027apps`** borrado por el usuario en el dashboard (decisión reset 2026-10-27), y recreado desde el repo por API:
  `027apps` (`prj_tYO9nHAactnHPQL6LtAzkw4RAPBM`), conectado a GitHub `rferic/027apps`.
- **Configuración** (verificada por API): Root Directory `apps/admin`, con ficheros de la raíz incluidos (workspace pnpm); framework Next.js; Node 26.x; Vercel Authentication activa en todos los deployments menos dominios custom.
- **Production Branch**: `production` (placeholder, no existe → producción en pausa hasta que exista el Core funcional; decisión 2026-10-25). El agente lo dejó en `main` por API (la API no permite cambiarlo por PATCH).
- **Env vars** (4, scope Preview, verificadas por API por nombre; nunca valores):
  - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publicas por diseño): creadas por el agente por API (tipo plain).
  - `SUPABASE_SERVICE_ROLE_KEY` y `SETTINGS_ENCRYPTION_KEY`: creadas por el agente por API (tipo **sensitive**), leyendo los valores desde ficheros locales (API de Supabase y `apps/admin/.env.local`) y borrando los ficheros temporales. Los valores nunca pasaron por el chat.
- **Primer deploy**: pendiente; se disparará con el primer PR (previews por PR sí).
- **Production scope** de las env vars: cuando exista `027apps-prod` (cierre de sprint-05).
