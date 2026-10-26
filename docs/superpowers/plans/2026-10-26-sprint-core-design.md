# Plan — Sprint 04: Diseño del Core (definición)

**Fecha:** 2026-10-26
**Task:** `docs/tasks/sprint-core-design/task-01..12.md` (pendientes)
**Rama:** `sprint/04-core-design` (PR en draft desde el arranque)
**Tipo:** sprint de **definición** — no genera código de producto; cada tarea entrega una **spec aprobada** que desbloquea la implementación del Core.

## Objetivo

Concretar la **superficie transversal inicial del Core** sobre el contrato estable de la spec de API v1 (finalizada 2026-10-25). El Core es una capacidad que crece con el proyecto (decisión del usuario, 2026-10-25); este sprint define **la base inicial** — esquema de datos, API transversal, sistema de módulos, config/instalación, MCP, realtime/notificaciones, jobs, observabilidad, i18n, seguridad, docs de API y shell del admin — como specs aprobadas listas para implementar.

**Puerta de entrada (cumplida):** spec de API v1 `finalizada` ✅ + specs de tokens y auth `finalizada` + ADRs 0004–0008 aceptados + testing strategy aprobada.

## Forma de trabajo

Cada tarea es un sprint de definición en miniatura (patrón sprint-03, ver planes `2026-10-25-sprint-03-*`):

1. **Conversación de diseño** con el usuario (decisora) sobre el alcance y las decisiones del entregable.
2. **Redacción de la spec** en `docs/superpowers/specs/` (o el destino que indique la tarea), con decisiones tomadas explícitas (§8).
3. **Revisión por segundo agente** (DoD de Docs: coherencia con spec/flujos/código real, rutas verificadas, sin contradicciones).
4. **Aprobación del usuario** y commit en la rama del sprint.

Las 12 tareas comparten **un solo plan** (lote, según `spec §11` reglas). Cada tarea declara al completarse su spec, sus decisiones clave y sus criterios de aceptación cumplidos.

## Tareas

| # | Tarea (fichero) | Entregable (spec) | Dependencias |
|---|---|---|---|
| 01 | Modelo de datos del Core y RLS (**reframe: categorías ≠ grupos de módulo**) | `docs/superpowers/specs/2026-10-26-core-data-model.md` | api-v1 ✅ (delta 2026-10-26), tokens ✅, ADR 0008 |
| 02 | Recursos y endpoints transversales del Core (+ rate limiting C1) | `docs/superpowers/specs/2026-10-26-core-api.md` | 01, api-v1 ✅ |
| 03 | Sistema de módulos + instalador en runtime | `docs/superpowers/specs/2026-10-26-modulo-system.md` | 01, 02, fundaciones ✅, api-v1 ✅ |
| 04 | Realtime y notificaciones del Core | `docs/superpowers/specs/2026-10-26-realtime-notificaciones.md` | 01, 02, ADR 0006 ✅, auth ✅ |
| 05 | MCP del Core | `docs/superpowers/specs/2026-10-26-mcp.md` | 02, api-v1 ✅, tokens ✅, ADR 0004 |
| 06 | Configuración de instancia y setup (`instance_settings` + wizard) | `docs/superpowers/specs/2026-10-26-instance-config.md` | 01, ADR 0008, ADR 0006, auth ✅ (wizard §3bis), api-v1 ✅ (C2/`/instance`) |
| 07 | Trabajos programados y mantenimiento del Core | `docs/superpowers/specs/2026-10-26-jobs-mantenimiento.md` | 01, 06, tokens ✅ (§6 auditoría), api-v1 ✅ (`/health`) |
| 08 | Observabilidad (Sentry, logs, `request_id`, guía) | `docs/superpowers/specs/2026-10-26-observabilidad.md` | 02, ADR 0007, spec §7 (Sentry), cicd.md |
| 09 | i18n operativa (check CI, sync, flujo traductor) | `docs/superpowers/specs/2026-10-26-i18n-operativa.md` | 01, ADR 0008, spec §11, testing ✅ |
| 10 | Seguridad de definición (OWASP, amenazas, secrets, RLS, dependabot) | `docs/superpowers/specs/2026-10-26-seguridad.md` | 01, 02, spec §11, DoD |
| 11 | Documentación de la API pública | `docs/api/README.md` (guía consumidores, enlaza OpenAPI) | 02, api-v1 ✅, spec §11 |
| 12 | Shell del admin (definición: navegación, roles, ADR 0005) | `docs/superpowers/specs/2026-10-26-admin-shell.md` | 02, ADR 0005, auth ✅, DS v1 ✅ |

## Orden de ejecución

1. **01 → 02** en serie (la 02 depende del esquema; la 01 del contrato establecido).
2. Tras la 02, **03, 04, 05, 08, 11 y 12** en paralelo (independientes entre sí sobre 01/02).
3. **06** tras 01 (y puede ir en paralelo con 02); **07** tras 01+06 (cierra el sistema de configuración).
4. **09** tras 01 (y refs i18n); **10** tras 01+02 (necesita esquema y API para amenazas/RLS/secrets).

El sprint de infra (`docs/tasks/sprint-infra/task-01..07.md`) sigue pendiente y puede ejecutarse en paralelo desde el lado del usuario (setup).

## Candidata a backlog registrada en paralelo

**`docs/tasks/sprint-web/task-01.md`** — sprint *Web de administración* (backlog, pendiente): base del admin web (login + `/setup`, página de documentación de la API con Swagger/alternativa sobre el OpenAPI generado, shell y páginas de gestión privadas: dashboard, configuraciones, usuarios, invitaciones, grupos, API keys). Depende de la API del Core implementada (API-first, ADR 0004) + Supabase Auth + OpenAPI generado.

## Criterios de cierre del sprint

- Las 12 tareas `finalizada` con su spec aprobada por el usuario y revisada por segundo agente (DoD de Docs).
- La rama `sprint/04-core-design` en verde con el PR (en draft desde el arranque) pasado a listo y mergeado tras el visto bueno del usuario.
- Sin `TODO` pendiente que afecte al arranque de la implementación del Core.

## Referencias

- Sprint: `docs/tasks/sprint-core-design/README.md` (registro del sprint, `estado: en curso`), tareas `task-01..12.md`
- Spec de base: `docs/superpowers/specs/2026-10-25-api-v1.md`
- Specs previas: `2026-10-25-token-model.md`, `2026-10-25-auth.md`, `2026-10-24-027apps-design.md`
- ADRs: `docs/adr/0004..0008`
- Testing: `docs/conventions/testing-strategy.md`
- Flujo de git: `docs/flows/git.md` (rama de sprint, PR en draft, squash merge)