---
id: sprint-08-new-module-skill
titulo: Metodología y skill para crear módulos con un agente
area: docs
estado: pendiente
plan: docs/superpowers/plans/2026-10-31-sprint-08-new-module-skill.md
spec: docs/superpowers/specs/2026-10-31-sprint-08-new-module-skill.md
---

Sprint de **documentación y tooling**: dejar para cualquier agente el funcionamiento de un
módulo (contrato del manifest, propiedades, requisitos, ciclo de vida) y crear la skill
`new-module` que ejecute la metodología. **No implementa** módulos, el instalador, el registry
ni el Core.

**Spec aprobada:** `docs/superpowers/specs/2026-10-31-sprint-08-new-module-skill.md`
(2026-10-31). **Contrato base:** `docs/superpowers/specs/2026-10-26-modulo-system.md` §3,
aprobado por el usuario.

**Estructura multi-proveedor:** fuente canónica en `docs/ai/module-system.md`; envoltorios
finos en `.opencode/`, `.claude/` y `.agents/`; `AGENTS.md` y `CLAUDE.md` como entradas.
La documentación va en español según `AGENTS.md`; la skill, en inglés por ser herramienta.

## Tareas (orden de ejecución)

| Orden | Tarea | Qué produce |
|---|---|---|
| 1 | **01** Documentación canónica + esquema del manifest | `docs/ai/module-system.md`, `docs/ai/manifest.schema.json`, ejemplos |
| 2 | **02** Metodología de creación de módulos | `docs/flows/new-module.md` completo |
| 3 | **03** Skill `new-module` + plantillas + dry-run | `.opencode/skills/new-module/`, probada con módulo ficticio temporal |
| 4 | **04** Entradas por proveedor | `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.agents/` |
| 5 | **05** Check de CI + plantilla de PR | Script de versión/punteros, job en `ci.yml`, PR template |
| 6 | **06** Integración y validación final | Roadmap, referencias, estados y revisión de segundo agente |

**Puerta de entrada:** contrato §3 aprobado. **Depende de:** nada implementado del Core. Las
fases ejecutables se marcan como bloqueadas hasta que existan el script de registry, la suite
RLS, los componentes del DS, la pipeline i18n y el instalador en runtime. **No bloquea** al
Core: corre en paralelo como vía de documentación/tooling.

## Criterios de cierre

- La documentación canónica no contradice la spec del sistema de módulos §3.
- El esquema valida el ejemplo del §3 y los ejemplos mínimos.
- `AGENTS.md`, `CLAUDE.md` y los envoltorios apuntan a la misma fuente canónica.
- La skill pide idea, ejemplos, identidad y manifest; analiza y enriquece; detecta
  contradicciones; cierra requisitos; pregunta si empezar el spec; genera spec + mockup;
  exige seguridad, API, MCP y tests.
- El dry-run con módulo ficticio produce brief, manifest, mockup, spec y `state.md`, y se
  detiene ante las carencias del Core.
- El check de CI pasa: versión del manifest y punteros.
- Revisión de segundo agente en cada tarea; auditoría de seguridad si el texto toca secretos
  o configuración sensible.
- No se implementa ningún módulo, instalador, registry ni Core.
