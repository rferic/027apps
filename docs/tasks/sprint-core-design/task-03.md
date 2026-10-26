---
id: sprint-core-design-task-03
titulo: Sistema de módulos + instalador en runtime — spec (definición)
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 3 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-modulo-system.md` — cómo se instalan y activan los módulos en runtime.

**Alcance** (spec de diseño §4 «Sistema de módulos» + `docs/flows/new-module.md`):
- Contrato definitivo del **`manifest.json`** de módulo (DDL con rollback, rutas, vistas, permisos, widgets, tools MCP, claves i18n) — la base la fijan las fundaciones; aquí se concreta el formato final.
- **Instalador en runtime**: apply del DDL con rollback, registro del módulo (registry), ciclo **instalación global por instancia → activación por grupo**.
- **Config de módulo por grupo**: dónde vive (config por grupo/módulo), p. ej. moneda de Split Expenses (ADR 0008 §7: la moneda es del grupo/módulo con default de instancia).
- Servicios `/modules` y `/groups/{id}/modules` (api-v1 §4) alimentados por este sistema, con la representación compartida.

**Decisiones a fijar**: formato exacto del manifest y su validación (zod en el borde), orden/mecánica del instalador (DDL global + rollback), dónde se guarda la config por grupo/módulo, seguridad del DDL en runtime (permisos mínimos, sin secrets), relación con la skill `new-module` (spec §9/§11).

**Criterios de aceptación**: un módulo se especifica, instala y desactiva sin tocar la mecánica del contrato (mecanismo de extensión de api-v1 §5); el DDL es reversible; la config por grupo queda modelada; coherente con ADR 0004/0007/0008.

**Referencias**: spec diseño §4/§11 (`2026-10-24-027apps-design.md`), flujo `docs/flows/new-module.md`, spec API v1 §4/§5, ADR 0008 §7, fundaciones (contrato de manifest).