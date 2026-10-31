---
id: sprint-08-new-module-skill-task-01
titulo: Documentación canónica + esquema del manifest
area: docs
estado: pendiente
plan: docs/superpowers/plans/2026-10-31-sprint-08-new-module-skill.md
fuente: docs/superpowers/specs/2026-10-26-modulo-system.md §3-§4; docs/superpowers/specs/2026-10-31-sprint-08-new-module-skill.md §5
adrs: [0004, 0007, 0008]
---

**Tarea**: crear la documentación canónica para IA (`docs/ai/module-system.md`), el esquema
legible por máquina (`docs/ai/manifest.schema.json`) y dos ejemplos (mínimo y completo).

**Alcance**:
- Contrato del manifest: propiedades, invariantes y regla de negocio del §3.
- Requisitos: estructura del paquete, DDL `up`/`down`, settings, i18n, scopes, tools MCP,
  canales, eventos, hooks, páginas de admin y docs por capacidad.
- Ciclo de vida: instalar, activar, desactivar, desinstalar.
- Seguridad, tests, API y MCP como secciones obligatorias.
- Regla de actualización cuando cambie el contrato.

**Criterios de aceptación**:
- La documentación no contradice la spec del sistema de módulos §3.
- El esquema valida el ejemplo del §3 y los ejemplos mínimos; un manifest inválido falla.
- El ejemplo mínimo no declara capacidades que no usa.
- Revisión de segundo agente (DoD de Docs).
