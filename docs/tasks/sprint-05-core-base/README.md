---
id: sprint-05-core-base
titulo: Core base — datos, auth, API, ajustes, i18n y observabilidad
area: core
estado: en curso
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
pr: sprint/05-core-base
---

Sprint de **implementación** (código real, TDD) del núcleo del Core: la base sobre la que se apoyan todos los módulos y el panel.

**Depende de:** `sprint-infra` task-04 (Supabase + envs) y task-09 (clave maestra). **Specs:** task-01/02/06/08/09 del sprint de diseño del Core.

| # | Tarea | Entregable |
|---|---|---|
| 01 | Migraciones base + RLS + suite de aislamiento | `profiles`, `settings*`, `currencies` con RLS y tests |
| 02 | Auth, sesión SSR y guard de scopes | login, sesión por cookies, `authorize()` con scopes y `role_cap`, `/setup` atómico |
| 03 | Esqueleto `/api/v1` | route handlers, envelope ADR 0007, `request_id`/`X-Request-Id`, zod `.strict()`, rate limiting |
| 04 | Salud, instancia y ajustes | `/health`, `/instance`, settings enmascarados, cifrado AES-GCM, currencies |
| 05 | i18n operativa | catálogo + locales, `i18n:scan`/`check` en CI, siembra, `/translations` con ETag |
| 06 | Observabilidad | logger JSON, Sentry con scrub fail-closed, verificación de la guía |

**Cierre:** `pnpm lint && pnpm tsc && pnpm test` + `build`, CI verde, DoD de Código (TDD, QA, **auditoría OWASP**) y `adrs:` declarados. Aceptación del resultado en preview (Vercel, infra-06).

## Cómo se ejecuta (2026-10-31)

- **Plan detallado al arrancar** (regla del roadmap): primer commit de ejecución = plan de implementación de sprint-05 (metodología `writing-plans`) en `docs/superpowers/plans/2026-10-31-sprint-05-core-base.md`, basado en las specs del sprint de diseño.
- **Entorno de ejecución**: el **stack Supabase local** (`supabase start`, versionado en el repo) es el entorno de desarrollo por defecto — migraciones y suite de aislamiento RLS corren primero aquí, sin proyecto cloud ni secretos (enmienda de infra-04, PR #21). El proyecto cloud `027apps-dev` + Vercel (infra-06) hacen falta para **cerrar** el sprint (aceptación en preview), no para empezar.
- **Un PR por sprint**: este PR recibe todas las tareas; squash merge solo con orden explícita del usuario. La evidencia de cada tarea va a su `docs/tasks/sprint-05-core-base/task-NN.md`.
