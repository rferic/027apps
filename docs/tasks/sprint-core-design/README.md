---
id: sprint-core-design
titulo: Diseño del Core (definición) — superficie transversal inicial
area: core
estado: en curso
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Sprint de **definición** (sin código de producto): diseñar la superficie inicial del **Core** — todo lo transversal/compartido entre módulos (spec §4). Sprint **planificado** (2026-10-26): el plan desglosa la superficie inicial en 12 tareas numeradas (task-01..12) sobre el contrato estable de la spec de API v1.

**Por qué existe:** el Core es una capacidad que crece con el proyecto y no se puede catalogar completo hoy (decisión del usuario, 2026-10-25). Este sprint concreta **la base inicial** sobre el contrato estable de la spec de API v1.

**Depende de:** ~~spec de API v1~~ (`docs/superpowers/specs/2026-10-25-api-v1.md`) **finalizada** ✅ (2026-10-25) — el contrato estable y el mecanismo de extensión están aprobados; la especificación de tokens, auth, ADRs 0001–0008 y testing strategy también `finalizada`. **Puerta de entrada cumplida: el sprint está desbloqueado y planificado.**

## Tareas del sprint (plan en `docs/superpowers/plans/2026-10-26-sprint-core-design.md`)

| # | Tarea | Entregable | Estado |
|---|---|---|---|
| 01 | Modelo de datos del Core y RLS (reframe: categorías ≠ grupos de módulo) | spec `2026-10-26-core-data-model.md` | ✅ `finalizada` (2026-10-26) |
| 02 | Recursos y endpoints transversales (+ rate limiting C1) | spec `2026-10-26-core-api.md` | ✅ `finalizada` (2026-10-26) |
| 03 | Sistema de módulos + instalador en runtime | spec `2026-10-26-modulo-system.md` | ✅ `finalizada` (2026-10-26) |
| 04 | Realtime y notificaciones del Core | spec `2026-10-26-realtime-notificaciones.md` | ✅ `finalizada` (2026-10-26) |
| 05 | MCP del Core | spec `2026-10-26-mcp.md` | ✅ `finalizada` (2026-10-26) |
| 06 | Configuración de instancia y setup (`settings`/`settings_categories` + wizard) | spec `2026-10-26-instance-config.md` | 🟡 `test` |
| 07 | Trabajos programados y mantenimiento | spec `2026-10-26-jobs-mantenimiento.md` | ⏳ pendiente |
| 08 | Observabilidad | spec `2026-10-26-observabilidad.md` | ⏳ pendiente |
| 09 | i18n operativa | spec `2026-10-26-i18n-operativa.md` | ⏳ pendiente |
| 10 | Seguridad de definición (OWASP, amenazas, secrets, RLS, dependabot) | spec `2026-10-26-seguridad.md` | ⏳ pendiente |
| 11 | Documentación de la API pública | `docs/api/README.md` | ⏳ pendiente |
| 12 | Shell del admin (definición) | spec `2026-10-26-admin-shell.md` | ⏳ pendiente |

**Puerta de entrada:** spec de API v1 `finalizada` (cumplida, 2026-10-25); sprint de infra (setup del usuario) puede ir en paralelo o después.