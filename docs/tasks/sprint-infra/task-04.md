---
id: sprint-infra-task-04
titulo: Proyecto Supabase + envs
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: docs/flows/cicd.md §B.3
---

**Tarea**: crear el/los proyecto(s) Supabase (dev/preview preferiblemente separado de prod), y guardar las env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) para Vercel (Preview y Production). Puerta de setup del usuario.

## Bitácora

- **2026-10-27 · decisión del usuario**: reset total — **sin backup** del legacy ni migración de cuentas (se re-crearán por invitación cuando exista el Core). Se **eliminan** los proyectos Supabase `027Apps` y `027apps-staging` (borrado permanente e irreversible, sin periodo de gracia, según `supabase.com/docs/guides/platform/delete-project`). No se reutiliza `027apps-staging` como proyecto dev: un `public` con restos contaminaría el baseline de migraciones/RLS del Core. Vercel: igual criterio — el proyecto legacy se borra y el nuevo se crea desde el repo (infra-06).
- **2026-10-27 · en curso.** Paso 3 del plan verificado antes de tocar nada: `apps/admin/.env.local` está ignorado (`apps/admin/.gitignore:34`, regla `.env*`) y no rastreado (`git ls-files` → 0). Existe `apps/admin/.env.example` con las tres claves (sin valores), que sirve de plantilla.
- **Pendiente (usuario)**: pasos 1–2 — crear el proyecto Supabase **`027apps-dev`** y escribir las tres variables en `apps/admin/.env.local`. El proyecto de **producción** se crea al cierre de sprint-05 (free tier pausa proyectos idle; ver plan).
- **2026-10-27 · stack local operativo (dev por defecto).** Se retiró el stack local del legacy (contenedores y volúmenes `supabase_*_027apps`, 3 meses parados) y se creó el del repo: `supabase init` → `supabase/config.toml` (`project_id = "027Apps"`) + `supabase/.gitignore`; `supabase start` → API `127.0.0.1:54321`, DB `54322`, Studio `54323`, Mailpit `54324` (`imgproxy`/`pooler` parados: no se usan). `.env.local` apunta al stack local con las claves **demo públicas**. Evidencia E2E: `PORT=3101 pnpm --filter admin dev` → `GET /api/health 200 {"status":"ok"}` (el puerto 3000 lo ocupa OrbStack; usar `PORT`).
- **Pendiente para `finalizada`**: (usuario) confirmar la **rotación** de la contraseña de BD de `027apps-dev` — se pegó en el chat, se considera expuesta; pasar el **project ref** de `027apps-dev` para anotarlo en `docs/infrastructure.md` (no es secreto); (infra-06) subir las tres envs del cloud a Vercel (Preview/Production).
- **Auditoría de seguridad (DoD Infra)**: `config.toml` sin JWT, contraseñas ni claves (solo `env()` comentados y rutas documentadas); `signing_keys_path` sin activar; `.env.local` ignorado (`apps/admin/.gitignore:34`) y no rastreado; claves del stack local = demo públicas; ningún valor de secreto en docs ni en logs.
- **2026-10-27 · riesgo aceptado (usuario)**: la rotación de la contraseña de BD de `027apps-dev` se aplaza por decisión explícita; el valor se pegó en el chat de la sesión, así que se considera expuesto. Alcance: solo la BD de **desarrollo** (sin producción, sin datos de familia). **Condición**: al crear `027apps-prod` (cierre de sprint-05), esa contraseña se genera nueva y no se comparte por chat; esta de dev se rota o se descarta entonces.
- **2026-10-31 · proyecto cloud creado y verificado.** El usuario creó `027apps-dev` y pasó el **project ref `wrigkwhrihawvwiciouy`** (dato público, registrado en `docs/infrastructure.md`). Verificación del agente sin claves: `curl https://wrigkwhrihawvwiciouy.supabase.co/auth/v1/health` → `401` con `"No API key found in request"` (el proyecto responde y exige apikey; un proyecto inexistente/pausado no daría eso).
- **Estado `finalizada`**: el ref está anotado; las env vars del cloud se suben a **Vercel** en infra-06 (`.env.local` apunta al stack local por diseño, enmienda del PR #21); la contraseña de BD de dev queda con el riesgo aceptado de la línea anterior (rotación/descarte al crear `027apps-prod`, nunca compartida otra vez por chat).
