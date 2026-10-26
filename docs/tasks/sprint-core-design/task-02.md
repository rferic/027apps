---
id: sprint-core-design-task-02
titulo: Recursos y endpoints transversales del Core — spec de API (definición)
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 2 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-core-api.md` — el inventario de la superficie transversal del Core sobre el contrato de API v1.

**Alcance**: sobre el contrato estable (`2026-10-25-api-v1.md`) y el esquema de la task-01, definir los endpoints transversales del Core más allá del mínimo de arranque:
- Grupos y membresías (`/groups`, `/groups/{id}/members`, roles admin/member), invitaciones (`/invitations`), participantes (`/participants`, ficticios + claiming), API keys (`/api-keys`, instancia/delegado), device tokens (`/device-tokens`), configuración de instancia (`/instance`), módulos (`/modules`, `/groups/{id}/modules`).
- Para cada recurso: **forma de la representación compartida** (ADR 0004 §7), **scopes por acción expuesta** (spec tokens §5, ADR 0004 §2), errores (envelope ADR 0007), paginación offset/cursor (api-v1 D2) si aplica.
- **Rate limiting C1** (decisión delegada por api-v1 §3.3): umbrales y ventanas por tipo de llamador (móvil alto / terceros bajo), almacén del contador, respuesta `429` con envelope. CORS C2 ya decidido → su configuración vive en `settings` (`connectivity.cors_allowlist`, task-06, modelo de la task-01).

**Decisiones a fijar**: inventario exacto de endpoints y verbos, umbrales concretos de rate limiting, scopes por acción, forma canónica de cada recurso.

**Criterios de aceptación**: todo endpoint respeta el contrato v1 (errores, paginación, auth, representación); el rate limiting queda con umbrales y mecanismo decididos; los recursos del Core sirven a móvil, admin y MCP con la misma representación (ADR 0004).

**Referencias**: spec API v1 (`2026-10-25-api-v1.md`), spec tokens §5 (`2026-10-25-token-model.md`), ADR 0004, ADR 0007, ADR 0008, task-01 (esquema).