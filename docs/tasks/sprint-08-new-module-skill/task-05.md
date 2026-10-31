---
id: sprint-08-new-module-skill-task-05
titulo: Check de CI + plantilla de PR
area: docs
estado: pendiente
plan: docs/superpowers/plans/2026-10-31-sprint-08-new-module-skill.md
fuente: docs/superpowers/specs/2026-10-31-sprint-08-new-module-skill.md §5.7, §9; .github/workflows/ci.yml
adrs: [0004, 0007, 0008]
---

**Tarea**: añadir un check barato que detecte la desincronización entre la documentación
canónica, el esquema y los envoltorios, y una plantilla de PR que recuerde la regla.

**Alcance**:
- `scripts/check-ai-docs.mjs`: compara `manifest_version` entre el esquema y la documentación;
  comprueba que `AGENTS.md`, `CLAUDE.md`, `.opencode`, `.claude` y `.agents` citan
  `docs/ai/module-system.md`.
- `.github/workflows/ci.yml`: job o step que ejecuta el script; permisos mínimos; sin secretos.
- `.github/pull_request_template.md`: resumen, checkbox de actualización del contrato y
  checklist de pruebas/seguridad.

**Criterios de aceptación**:
- El script falla cuando debe fallar y pasa cuando debe pasar; se prueba con un cambio
  temporal en la versión o en un puntero.
- El check corre en PR y en `main`.
- La plantilla no contradice `AGENTS.md`.
- Revisión de segundo agente (DoD de Docs).
