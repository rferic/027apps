---
id: sprint-infra-task-04
titulo: Proyecto Supabase + envs
area: infra
estado: en curso
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: docs/flows/cicd.md §B.3
---

**Tarea**: crear el/los proyecto(s) Supabase (dev/preview preferiblemente separado de prod), y guardar las env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) para Vercel (Preview y Production). Puerta de setup del usuario.

## Bitácora

- **2026-10-27 · decisión del usuario**: reset total — **sin backup** del legacy ni migración de cuentas (se re-crearán por invitación cuando exista el Core). Se **eliminan** los proyectos Supabase `027Apps` y `027apps-staging` (borrado permanente e irreversible, sin periodo de gracia, según `supabase.com/docs/guides/platform/delete-project`). No se reutiliza `027apps-staging` como proyecto dev: un `public` con restos contaminaría el baseline de migraciones/RLS del Core. Vercel: igual criterio — el proyecto legacy se borra y el nuevo se crea desde el repo (infra-06).
- **2026-10-27 · en curso.** Paso 3 del plan verificado antes de tocar nada: `apps/admin/.env.local` está ignorado (`apps/admin/.gitignore:34`, regla `.env*`) y no rastreado (`git ls-files` → 0). Existe `apps/admin/.env.example` con las tres claves (sin valores), que sirve de plantilla.
- **Pendiente (usuario)**: pasos 1–2 — crear el proyecto Supabase **`027apps-dev`** y escribir las tres variables en `apps/admin/.env.local`. El proyecto de **producción** se crea al cierre de sprint-05 (free tier pausa proyectos idle; ver plan).
- **Pendiente (agente)**: paso 4 — E2E local `/api/health` → `200 ok`; paso 5 — evidencia y cierre. La subida de envs a Vercel es la tarea infra-06 (task 4 del plan).
