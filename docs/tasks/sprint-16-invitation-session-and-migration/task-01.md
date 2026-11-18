---
id: sprint-16-task-01
titulo: Documentación del sprint (spec, plan y tareas)
area: docs
estado: finalizada
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
adrs: [0004, 0007, 0008, 0010]
---

**Tarea**: dejar el sprint 16 listo para aprobar: spec, plan, once fichas de tarea, índice de
sprints y preservación del plan anterior (panel y notificaciones) como sprint 17. **Sin código de
producto.**

**Punto de partida**
- El plan de «panel y notificaciones» vivía en `origin/docs/sprint-16` sin aprobar y sin llegar a
  `staging`; parte de sus tareas ya están en `staging` (importador, transacción, pestañas).
- La rama actual es `sprint/16-invitation-session-and-migration`, desde `origin/staging`
  (último commit `2d750f5`). El worktree es
  `/Users/ericrf/orca/workspaces/027apps/sprint-16-invitation-session-and-migration`.

**Alcance**
- Dentro:
  - `docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md`: alcance, no
    objetivos, hechos verificados, decisiones cerradas y propuestas, modelo de datos, contrato de
    API, flujos, estados, seguridad, i18n, pruebas y puertas.
  - `docs/superpowers/plans/2026-11-16-invitation-session-migration.md`: pasos con checkbox,
    ficheros, interfaces, TDD rojo→verde y aceptación por tarea.
  - `docs/tasks/sprint-16-invitation-session-and-migration/README.md` + `task-01…11.md`.
  - `docs/tasks/sprint-16-invitation-session-and-migration/pre-implementation-review.md`:
    revisión de seguridad y UX del planteamiento, con D21 y los ajustes incorporados.
  - `docs/tasks/sprint-17-panel-y-notificaciones/README.md` con el plan anterior íntegro y una nota
    de renumeración.
  - `docs/tasks/README.md` con las filas 16 y 17; `docs/tasks/backlog.md` con la nota actualizada.
  - Nota «superseded by» en la spec del canje web de 2026-11-07.
- Fuera: cualquier cambio en `apps/`, `packages/` o `supabase/`.

**Dependencias**: ninguna. Es la puerta P1 del sprint.

**Riesgos**: que la renumeración del 17 se lea como un borrado (se preserva el contenido y se dice
en el índice); que la spec proponga decisiones que el propietario no quiera (están marcadas como
propuestas, no como cerradas).

**Criterios de aceptación**
- El propietario puede leer la spec, el plan, las 11 tareas y la revisión pre-implementación y
  aprobar o pedir cambios.
- `git diff --check` limpio; las rutas citadas existen o se marcan como «se crearán».
- El plan anterior está preservado en `sprint-17-panel-y-notificaciones` y la rama
  `origin/docs/sprint-16` no se ha tocado.
- Revisión por un segundo agente (DoD de Docs) y hallazgos corregidos.
- **No hay código de producto.**

**Puertas de usuario**
- Aprobar la spec y el plan (P1), incluidas D1–D20.
- Confirmar la renumeración del plan anterior a sprint 17 (o moverlo al backlog si lo prefiere).

**Auditoría de seguridad**: no aplica código; la spec incluye el análisis A01–A11 que se ejecutará
en la tarea 11.
