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

## Bitácora

- 2026-10-31: reescrito `docs/flows/new-module.md` con las fases de la spec aprobada:
  intake (idea, necesidad, funcionalidades, concepto), ejemplos, identidad y manifest,
  análisis y enriquecimiento, cierre de requisitos, puerta «¿empezamos el spec?», spec +
  mockup HTML+JS y cierre. El contrato del manifest se enlaza a `docs/ai/module-system.md`;
  no se duplica.
- Añadidas las puertas de usuario y la condición de que el spec no está completo sin mockup
  aceptado. Aclarados los roles: el implementador marca `en curso`; el orquestador, `test` y
  `finalizada`.
- Preparadas las plantillas de apoyo para la tarea 03: `state.md`, `templates/README.md` y
  `module-spec.md` (referencia al contrato canónico).
- Estado `test`: pendiente de revisión de segundo agente (DoD de Docs).
