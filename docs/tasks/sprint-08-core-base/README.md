---
id: sprint-08-core-base
titulo: Core base — datos, auth, API, ajustes, i18n y observabilidad
area: core
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
pr: sprint/08-core-base
---

Sprint de **implementación** (código real, TDD) del núcleo del Core: la base sobre la que se apoyan todos los módulos y el panel.

**Depende de:** `sprint-04-infra` task-04 (Supabase + envs) y task-09 (clave maestra). **Specs:** task-01/02/06/08/09 del sprint de diseño del Core.

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

- **Plan detallado al arrancar** (regla del roadmap): primer commit de ejecución = plan de implementación de sprint-08-core-base (metodología `writing-plans`) en `docs/superpowers/plans/2026-10-31-sprint-08-core-base.md`, basado en las specs del sprint de diseño.
- **Entorno de ejecución**: el **stack Supabase local** (`supabase start`, versionado en el repo) es el entorno de desarrollo por defecto — migraciones y suite de aislamiento RLS corren primero aquí, sin proyecto cloud ni secretos (enmienda de infra-04, PR #21). El proyecto cloud `027apps-dev` + Vercel (infra-06) hacen falta para **cerrar** el sprint (aceptación en preview), no para empezar.
- **Un PR por sprint**: este PR recibe todas las tareas; squash merge solo con orden explícita del usuario. La evidencia de cada tarea va a su `docs/tasks/sprint-08-core-base/task-NN.md`.

## Cierre (2026-11-05)

- **Tareas `finalizada`**: 01 (migraciones + RLS), 02 (auth/SSR/setup), 03 (API v1), 04 (salud/instancia/settings/currencies), 05 (i18n), 06 (observabilidad) y 07 (wizard 5 pasos, añadida durante el sprint).
- **Puerta local**: `pnpm lint`, `pnpm tsc`, `pnpm test` (i18n 16, core 112, admin 77, db-tests 91), `pnpm i18n:check` y `pnpm --filter admin build` en verde.
- **CI**: `admin`, `android`, `guard-secrets`, `supabase`, `commitlint` en verde en el PR #26 (release solo en tags).
- **QA + auditoría OWASP por tarea**: aprobadas con cambios; los hallazgos altos/medios corregidos y con test de regresión (ver bitácoras de cada `task-NN.md`).
- **Preview**: deployments de Vercel de la rama validados por el usuario (wizard, panel, logo, logout). El merge squash a `main` queda a la orden explícita del usuario.
