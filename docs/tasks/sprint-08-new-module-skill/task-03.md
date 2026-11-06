---
id: sprint-08-new-module-skill-task-03
titulo: Skill new-module + plantillas + dry-run
area: docs
estado: finalizada
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

## Bitácora

- **RED (sin skill, `family-calendar`)**: el subagente siguió el flujo de `docs/flows/new-module.md`
  y produjo un plan razonable: preguntó idea/necesidad/funcionalidades, ejemplos, identidad,
  cerró requisitos, propuso spec + mockup, checks de seguridad/API/MCP/RLS y stop conditions
  del Core. **Lagunas observadas**: improvisó el cuestionario en vez de usar el §1.1; no citó
  las plantillas (`state.md`, `module-spec.md`) como artefactos; no explicitó que el módulo es
  una feature ni que la spec no está completa sin mockup aceptado; no dejó claro que el
  contrato no debe duplicarse.
- **GREEN (con skill)**: el subagente leyó `SKILL.md` y la documentación canónica, y siguió las
  fases: intake, ejemplos, identidad/manifest, análisis/enriquecimiento, cierre de requisitos,
  puerta «¿empezamos el spec?», spec + mockup y plan. Usó las plantillas (`state.md`), detectó
  una contradicción relevante con la spec de diseño (§3 «Eventos familiares»), comprobó el
  encaje con `participants`/`group_id`/RLS/Core, y dejó los bloqueos del Core declarados sin
  inventar stubs. Confirmó que la spec no está completa sin mockup aceptado.
- **REFACTOR**: se añadieron dos reglas explícitas a `SKILL.md`: usar el cuestionario del
  §1.1 sin improvisar y no duplicar el contrato del manifest (enlazar
  `docs/ai/module-system.md`). El escenario GREEN ya cumplía el resto de criterios.
- **Evidencia**: sesiones de subagente RED `ses_e6d7469b0ffeVzAE7F1zTN1yC3` y GREEN
  `ses_e6d6fbcbaffe2tgiqmGUxf51lP`; no se ha commiteado ningún artefacto del módulo ficticio.
- **Re-test tras REFACTOR**: smoke test con la skill actualizada (sesión
  `ses_e6d67caffffekO3S4JnTokdGi6`): usa el cuestionario del §1.1 sin improvisar, copia
  `state.md` como primer artefacto, respeta la puerta «¿Empezamos el spec?», no inventa el
  instalador (lo declara bloqueado y deja el módulo en `test`) y no duplica el contrato.
- Estado `test`: pendiente de revisión de segundo agente (DoD de Docs).
