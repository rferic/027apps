---
id: sprint-08-new-module-skill-task-06
titulo: Integración y validación final
area: docs
estado: pendiente
plan: docs/superpowers/plans/2026-10-31-sprint-08-new-module-skill.md
fuente: docs/superpowers/specs/2026-10-31-sprint-08-new-module-skill.md §9, §11; docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
adrs: [0004, 0007, 0008]
---

**Tarea**: integrar el sprint en el roadmap y las referencias, verificar la no-regresión y
cerrar el sprint con la revisión de segundo agente.

**Alcance**:
- Añadir `sprint-08-new-module-skill` como vía paralela en el roadmap del Core.
- Actualizar la spec del sistema de módulos para referenciar la metodología y la skill (sin
  tocar el contrato).
- Revisar `AGENTS.md`, `docs/flows/agents.md` y `feature.md` para enlaces que falten.
- Ejecutar `pnpm lint && pnpm tsc && pnpm test` y `node scripts/check-ai-docs.mjs`.
- Actualizar estados de las seis tareas a `finalizada` tras resolver hallazgos.

**Criterios de aceptación**:
- El roadmap deja claro que el sprint no es dependencia del Core.
- Todos los enlaces apuntan a ficheros existentes.
- `pnpm` y el check de CI en verde con salida leída.
- Revisión de segundo agente (DoD de Docs); auditoría de seguridad si toca secretos o
  configuración sensible.
