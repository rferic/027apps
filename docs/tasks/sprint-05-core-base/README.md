---
id: sprint-05-core-base
titulo: Core base — datos, auth, API, ajustes, i18n y observabilidad
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
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

**Cierre:** `pnpm lint && pnpm tsc && pnpm test` + `build`, CI verde, DoD de Código (TDD, QA, **auditoría OWASP**) y `adrs:` declarados.
