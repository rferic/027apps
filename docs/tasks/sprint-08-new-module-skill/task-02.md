---
id: sprint-08-new-module-skill-task-02
titulo: Metodología de creación de módulos (flujo para agentes)
area: docs
estado: test
plan: docs/superpowers/plans/2026-10-31-sprint-08-new-module-skill.md
fuente: docs/ai/module-system.md; docs/superpowers/specs/2026-10-31-sprint-08-new-module-skill.md §6; docs/flows/feature.md; docs/flows/agents.md
adrs: [0004, 0007, 0008]
---

**Tarea**: completar `docs/flows/new-module.md` como metodología reproducible para que un
agente cree un módulo: fases, entradas/salidas, artefactos, puertas de usuario, *stop
conditions* por dependencia no implementada y checklist de cierre.

**Alcance**:
- Preguntas de intake: idea, necesidad, funcionalidades, concepto, ejemplos de apps, nombre,
  icono/logo y propiedades del manifest.
- Fases: intake, ejemplos, identidad/manifest, análisis y enriquecimiento, cierre de
  requisitos, puerta «¿empezamos el spec?», spec + mockup, cierre.
- Puertas alineadas con `agents.md`; stop conditions por Core ausente.
- Mantener el flujo de 10 pasos como resumen canónico; no duplicar el contrato del manifest.

**Criterios de aceptación**:
- Un agente que lea solo el flujo sabe qué preguntar, qué artefactos producir, en qué orden,
  qué puertas respetar y cuándo parar.
- Sin contradicciones con `docs/ai/module-system.md`, `feature.md` ni `agents.md`.
- Rutas y comandos citados verificados.
- Revisión de segundo agente (DoD de Docs).

## Bitácora (2026-10-31)

- `docs/flows/new-module.md` completado de 24 líneas (stub) a 216: cuándo se usa, intake,
  fases y puertas (resumen canónico de 10 pasos), detalle por fase, stop conditions por
  dependencia del Core ausente, checklist de cierre, errores comunes y referencias.
- Sin duplicación del contrato: el manifest se describe por referencia a `docs/ai/module-system.md`.
- Estado `test`: pendiente de revisión de segundo agente (DoD de Docs) — igual que task-01.
