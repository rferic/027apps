---
id: sprint03-task-06
titulo: Spec de API v1 — `docs/superpowers/specs/2026-10-25-api-v1.md` (definición)
area: core
estado: en curso
---

Tarea 6 del sprint 03. Sprint de **definición** (sin código): la spec que fija el contrato estable de la API pública v1 y el mecanismo de extensión del Core.

**Entregable**: `docs/superpowers/specs/2026-10-25-api-v1.md` — contrato estable (versión `/api/v1`, OpenAPI generado desde zod, autenticación por API keys/JWT, rate limiting por identidad, CORS por instancia, envelope de errores ADR 0007, paginación offset+cursor, fechas/moneda ADR 0008, MCP sobre el mismo backbone, eventos `{ type, resource, payload }`) + mínimo transversal de arranque (`/health`, `/instance`, `/modules`, `/groups/{id}/modules`) + mecanismo de extensión.

**Nota de alcance (decisión del usuario, 2026-10-25):** esta spec **no** cataloga el inventario del Core (capacidad transversal que crece); la superficie inicial del Core se diseña en el sprint `docs/tasks/sprint-core-design/` sobre este contrato.

**Correcciones de la revisión de segundo agente (2026-10-25):** token de MCP corregido a **clave de instancia** `027_svc_` (la taxonomía de tokens no tiene tipo `mcp`); enlaces de la cabecera corregidos; revisión del «por IP» de la token spec registrada (rate limiting por identidad); matiz del mínimo de arranque en la decisión G; desviación del ADR 0006 (envelope de eventos aquí, payloads por módulo) registrada; trade-off de `requires_setup` público documentado.