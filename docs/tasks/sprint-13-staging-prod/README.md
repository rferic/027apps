---
id: sprint-13-staging-prod
titulo: Entornos staging y producción con deploy automático
area: infra
estado: en curso
plan: docs/superpowers/plans/2026-11-08-staging-production.md
spec: docs/superpowers/specs/2026-11-08-staging-production-design.md
---

Sprint de **infraestructura**: activar producción y staging con deploy automático al mergear,
dos proyectos Supabase, migraciones por entorno, backup cifrado y keep-alive, según el
[ADR 0010](../../adr/0010-entornos-y-ramas.md).

**Modelo de entornos:**

| Rama | Vercel | Dominio | Supabase | Deploy |
|---|---|---|---|---|
| `sprint/*`, `fix/*` (PR) | Preview | URL del deployment | `027apps-dev` | automático |
| `staging` | Preview con variables por rama | `staging.027apps.ericrf.com` | `027apps-dev` | automático al mergear |
| `main` | Production | `027apps.ericrf.com` | `027apps-prod` | automático al mergear |

**Flujo:** rama de trabajo → PR a `staging` (deploy + migraciones a `027apps-dev`) → pruebas →
PR `staging → main` (deploy + migraciones a `027apps-prod` tras aprobación). Regla dura: nada
a `main` sin pasar por `staging`. Tras cada release: merge `main → staging`.

## Tareas (orden de ejecución)

| Orden | Tarea | Qué produce |
|---|---|---|
| 1 | **01** Modelo de entornos y ramas | ADR 0010 + spec + flujos alineados |
| 2 | **02** Protección de ramas y contrato de promoción | `main`/`staging` protegidas, checks requeridos |
| 3 | **03** CI en dos entornos | `ci.yml` con push a `staging` |
| 4 | **04** Migraciones por entorno | Jobs dev/prod, prod detrás de aprobación |
| 5 | **05** Vercel | *Production Branch* = `main`, dominio staging, variables prod |
| 6 | **06** Supabase `027apps-prod` | Proyecto prod + SMTP + rotación dev |
| 7 | **07** Backup cifrado real | Primer snapshot + simulacro (contra prod) |
| 8 | **08** Keep-alive y runbook de release | `PROD_URL` + runbook promoción/rollback |

**Dependencias:** 01 → 02 → 03/04; 05 y 06 en paralelo tras 02; 07 y 08 tras 06 (necesitan
`027apps-prod`). Puertas de usuario en 02, 04, 05, 06, 07 y 08. Absorbe
`sprint-11-prod-activation`.

## Criterios de cierre

- Los 12 criterios de aceptación de la spec se cumplen con evidencia.
- `cicd.md`, `git.md`, `release.md`, `infrastructure.md` y `AGENTS.md` describen el modelo sin
  contradicciones.
- Auditoría de seguridad superada en toda implementación.
- Un solo PR por sprint; squash merge con orden explícita del usuario.
