---
id: sprint-08-new-module-skill-task-04
titulo: Entradas por proveedor (AGENTS.md, CLAUDE.md, .claude, .agents)
area: docs
estado: pendiente
plan: docs/superpowers/plans/2026-10-31-sprint-08-new-module-skill.md
fuente: docs/superpowers/specs/2026-10-31-sprint-08-new-module-skill.md §4, §7; AGENTS.md
adrs: [0004, 0007, 0008]
---

**Tarea**: preparar las entradas por proveedor para que OpenCode, Claude y futuros
proveedores encuentren la misma fuente canónica y la skill `new-module`.

**Alcance**:
- `AGENTS.md`: sección `Module contract changes`, fila `module-contract` en la tabla de
  obligaciones, check antes de commit y puntero a `docs/ai/module-system.md`.
- `CLAUDE.md`: `@AGENTS.md` + puntero a la documentación canónica y a `.claude/skills/new-module/SKILL.md`.
- `.claude/skills/new-module/SKILL.md` y `.agents/skills/new-module/SKILL.md`: envoltorios
  finos con metadatos y la instrucción de leer la fuente canónica.
- No duplicar el contrato completo en los envoltorios.

**Criterios de aceptación**:
- Todos los punteros citan `docs/ai/module-system.md` y los ficheros existen.
- `AGENTS.md` conserva el contrato compartido y no contradice `CLAUDE.md`.
- Revisión de segundo agente (DoD de Docs).
