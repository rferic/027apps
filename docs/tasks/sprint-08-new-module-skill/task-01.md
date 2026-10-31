---
id: sprint-08-new-module-skill-task-01
titulo: Documentación canónica + esquema del manifest
area: docs
estado: test
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

## Bitácora

- 2026-10-31: leídas las fuentes. Contradicciones detectadas y resueltas a favor de la
  spec del sistema de módulos (aprobada): activación por usuario/grupo (frente a «por grupo»
  de la spec de diseño) y manifest sin rutas HTTP (frente a «rutas» de la spec de diseño).
- Creados `docs/ai/module-system.md`, `docs/ai/manifest.schema.json`,
  `docs/ai/examples/minimal.json` y `docs/ai/examples/full.json`.
- Validación: `pnpm dlx ajv-cli@5 validate ... --strict=false` → ambos ejemplos válidos.
  El modo estricto falla por la keyword de extensión `x-manifest-version`; el check de la
  tarea 05 debe usar `strict: false` o ignorar keywords desconocidas.
- Estado `test`: pendiente de revisión de segundo agente (DoD de Docs).
