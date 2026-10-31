---
id: sprint-08-new-module-skill-task-03
titulo: Skill new-module + plantillas + dry-run
area: docs
estado: pendiente
plan: docs/superpowers/plans/2026-10-31-sprint-08-new-module-skill.md
fuente: docs/superpowers/specs/2026-10-31-sprint-08-new-module-skill.md §6; docs/ai/module-system.md; docs/flows/new-module.md
adrs: [0004, 0007, 0008]
---

**Tarea**: crear la skill de proyecto `new-module` en `.opencode/skills/new-module/SKILL.md`
y las plantillas mínimas (`manifest.json`, spec de módulo y `state.md`) para que el agente
ejecute la metodología de task-02.

**Método (writing-skills, TDD)**:
1. **RED**: escenario base con un subagente sin la skill (módulo ficticio `family-calendar`);
   documentar comportamiento y racionalizaciones. No se commitea el módulo.
2. **GREEN**: escribir la skill mínima que corrija esos fallos.
3. **REFACTOR**: repetir el escenario con la skill; cerrar atajos y lagunas.

**Criterios de aceptación**:
- `SKILL.md` con `name`/`description` válidos, disparador claro y flujo enlazado a
  `docs/flows/new-module.md`.
- Plantillas válidas contra los invariantes del manifest (§3) — sin valores de ejemplo que
  parezcan reales.
- Escenario con skill: el agente pide idea, ejemplos, identidad y manifest; analiza y
  enriquece; detecta contradicciones; cierra requisitos; pregunta si empezar el spec; genera
  spec + mockup; no inventa Core y se detiene en las puertas.
- Resultados de RED/GREEN documentados en la bitácora de la tarea.
