# Sprint 08 — Metodología y skill `new-module` (plan de implementación)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar para cualquier agente el funcionamiento de un módulo (contrato del manifest, propiedades, requisitos, ciclo de vida) y crear la skill `new-module` que ejecute la metodología — sin inventar piezas del Core que aún no existen.

**Architecture:** Seis tareas secuenciales sobre documentación y tooling, sin código de producto: (1) documentación canónica + esquema del manifest; (2) metodología en `docs/flows/new-module.md`; (3) skill `.opencode/skills/new-module/` + plantillas, probada con un módulo ficticio temporal; (4) entradas por proveedor (`AGENTS.md`, `CLAUDE.md`, `.claude/`, `.agents/`); (5) check de CI y plantilla de PR; (6) integración y validación final. La skill **no implementa** el instalador ni el registry: los detecta como dependencia ausente y detiene al agente con un informe.

**Tech Stack:** Markdown (docs del repo), JSON Schema, skill de OpenCode (`SKILL.md` + plantillas), Node para el check de CI. Sin dependencias nuevas de producto.

**Spec:** `docs/superpowers/specs/2026-10-31-sprint-08-new-module-skill.md` (aprobada 2026-10-31).
**Contrato base:** `docs/superpowers/specs/2026-10-26-modulo-system.md` §3 (aprobado por el usuario).
**Flujo base:** `docs/flows/feature.md`; un módulo es una feature. `docs/flows/agents.md` (roles y puertas).

## Arranque

- [ ] Crear el worktree de Orca ADE dedicado al sprint (nombre `sprint-08-new-module-skill`) desde `main` actualizado. Si la rama ya existe en el worktree principal, renombrarla o crear una rama nueva para el worktree y dejar claro cuál es la del sprint.
- [ ] Abrir el PR del sprint en **draft** desde el arranque. Un PR por sprint; squash merge solo con orden explícita del usuario.

## Global Constraints

- **No se redefine el contrato del manifest**: se enlaza la spec §3 y sus invariantes. Cualquier cambio de contrato exige aprobación del usuario y revisión de la spec.
- **Un módulo es una feature**: el flujo base es `feature.md`; `new-module.md` añade los pasos específicos (manifest, DDL `up`/`down`, settings, i18n, tools MCP, eventos, páginas de admin, docs por capacidad).
- **Stop conditions explícitas**: si falta el script de registry, la suite RLS, los componentes del DS, la pipeline i18n o el instalador en runtime, el agente **para y reporta**; no inventa contratos ni stubs que parezcan definitivos.
- **Secretos**: el flujo y la skill no contienen valores de secretos; los settings `is_secret` se describen por su contrato, nunca con ejemplos que parezcan credenciales reales.
- **Idioma**: documentación en `docs/`, `AGENTS.md` y `CLAUDE.md` en español; la skill en inglés por ser herramienta. Superficie de GitHub (rama, commits, PR) en inglés. Conventional Commits.
- **Sin duplicación**: el contrato completo vive en `docs/ai/module-system.md`; los envoltorios solo apuntan a él.
- **Sin código de producto**: no se crea el instalador, el registry ni tests de RLS. Esos van al backlog del Core.
- **Seguridad, tests, API y MCP** son secciones obligatorias de la documentación y de la plantilla de spec del módulo.
- **Módulo ficticio temporal**: no se commitea; se documenta el resultado del dry-run en la tarea.

## Review Focus

1. **La documentación canónica contradice §3** → task-01: revisión contra la spec del sistema de módulos; cualquier divergencia se corrige o se para.
2. **El esquema no valida el ejemplo §3** → task-01/task-05: el esquema y los ejemplos deben validar; el check de CI lo verifica.
3. **La skill empuja a inventar el Core** → task-03: dry-run con módulo ficticio donde el agente debe parar en las dependencias ausentes; se verifica que no crea stubs falsos.
4. **Duplicación y deriva entre flujo, skill y documentación** → task-02/task-03: la skill enlaza la fuente canónica y no repite el contrato.
5. **Skill no probada** → task-03: RED (sin skill) y GREEN (con skill) documentados con el comportamiento observado; sin evidencia no se marca `finalizada`.
6. **Entradas por proveedor desincronizadas** → task-04/task-05: `AGENTS.md`, `CLAUDE.md`, `.opencode`, `.claude` y `.agents` apuntan a la misma fuente; el check de CI lo verifica.
7. **Regla de actualización ausente** → task-04: `AGENTS.md` incluye `Module contract changes`, fila en la tabla de obligaciones y check de commit.
8. **Contradicciones con `feature.md`/`agents.md`** → task-02/task-06: un módulo sigue siendo una feature; las puertas del usuario coinciden con `agents.md`.

---

### Task 1 — sprint-08-task-01: Documentación canónica + esquema del manifest

**Files:**
- Create: `docs/ai/module-system.md`
- Create: `docs/ai/manifest.schema.json`
- Create: `docs/ai/examples/minimal.json`
- Create: `docs/ai/examples/full.json`
- Modify: `docs/tasks/sprint-08-new-module-skill/task-01.md` (bitácora y estado)

**Interfaces:**
- Produces: contrato canónico y esquema que consumen la metodología (task-02), la skill (task-03) y las entradas por proveedor (task-04).
- Consumes: `docs/superpowers/specs/2026-10-26-modulo-system.md` §3 y §4; `docs/superpowers/specs/2026-10-24-027apps-design.md` §4; ADRs 0004/0007/0008.

- [ ] **Step 1: Leer las fuentes y detectar contradicciones**

Leer: `docs/superpowers/specs/2026-10-26-modulo-system.md` §3–§4 y §10; `docs/superpowers/specs/2026-10-24-027apps-design.md` §4 y §9/§11; ADRs 0004/0007/0008; `docs/conventions/security-checklist.md`; `docs/conventions/testing-strategy.md`. Anotar en la bitácora de `task-01.md` cualquier contradicción entre la spec y la documentación que se va a escribir. Si una contradicción exige cambiar la spec, parar y pedir aprobación.

Expected: lista de contradicciones vacía o con su resolución propuesta.

- [ ] **Step 2: Escribir `docs/ai/module-system.md`**

Estructura mínima:
1. Qué es un módulo: paquete del monorepo, manifest, instalación global + activación por usuario/grupo.
2. Contrato del manifest: enlace al esquema, ejemplo completo y ejemplos mínimos.
3. Propiedades y requisitos: estructura del paquete, DDL `up`/`down`, settings, i18n, scopes, tools MCP, canales, eventos, hooks, páginas de admin y docs por capacidad.
4. Ciclo de vida: instalar, activar, desactivar, desinstalar; transacción y rollback; siembra de settings/i18n.
5. Seguridad: modelo de amenazas, authz, RLS, validación, secretos, datos familiares, API, MCP y auditoría.
6. Tests: dominio, API, RLS, integración, MCP, migraciones, E2E y seguridad.
7. API y MCP: API-first `/api/v1`; contrato de endpoints; MCP opt-in con scopes, efectos secundarios y auditoría.
8. Regla de actualización: cambios en el contrato obligan a actualizar esta documentación, el esquema, `AGENTS.md`/`CLAUDE.md` y los envoltorios en el mismo PR.
9. Dependencias del Core y stop conditions.

No duplicar la spec completa: enlazar §3 y resumir las invariantes.

Expected: un agente sin contexto previo entiende el contrato y sabe qué documentar/validar.

- [ ] **Step 3: Escribir el esquema `docs/ai/manifest.schema.json`**

Incluir:
- `$schema`, `$id`, `title`, `description`, `type: object`.
- Propiedades obligatorias y opcionales del §3.
- Validaciones: `key` kebab-case, palabras reservadas, `version` semver, migraciones con `up`/`down` y digests, settings completos, scopes `recurso:acción`, tools MCP con `kind`, canales con `pattern`/`members_fn`, eventos con `target`, páginas de admin con ruta de un segmento.
- `manifest_version` como campo de versión del contrato (para el check de CI).

Expected: el ejemplo del §3 y los ejemplos mínimos validan contra el esquema; un manifest inválido falla.

- [ ] **Step 4: Crear ejemplos**

- `docs/ai/examples/minimal.json`: módulo mínimo con `key`, `name`, `branding`, `version`, `docs.readme`.
- `docs/ai/examples/full.json`: ejemplo del §3 con todas las capacidades.

Expected: ambos validan; el minimal no declara capacidades que no usa.

- [ ] **Step 5: Autorevisión y paso a `test`**

Revisar contra §3/§4. Actualizar `task-01.md` con la bitácora y `estado: test`.

Expected: sin contradicciones; el revisor de tarea (segundo agente) recibe el diff y la lista de verificación.

---

### Task 2 — sprint-08-task-02: Metodología de creación de módulos

**Files:**
- Modify: `docs/flows/new-module.md` (reescritura completa; conservar referencias y el flujo de 10 pasos como resumen)
- Modify: `docs/tasks/sprint-08-new-module-skill/task-02.md` (bitácora y estado)

**Interfaces:**
- Consumes: `docs/ai/module-system.md` (task-01) y el contrato §3.
- Produces: metodología canónica que la skill (task-03) carga y ejecuta. Consumidores: `.opencode/skills/new-module/SKILL.md`, `docs/flows/feature.md` (variante «Módulo nuevo»), `docs/flows/agents.md` (puertas).

- [ ] **Step 1: Leer las fuentes y detectar contradicciones**

Leer: `docs/ai/module-system.md`; `docs/flows/feature.md`; `docs/flows/agents.md`; `docs/conventions/definition-of-done.md` §Docs; `docs/flows/new-module.md` actual. Anotar contradicciones en la bitácora.

Expected: lista de contradicciones vacía o con su resolución propuesta. Si una contradicción exige cambiar la spec, parar y pedir aprobación.

- [ ] **Step 2: Reescribir `docs/flows/new-module.md`**

Estructura mínima:
1. Cabecera y concepto de módulo (paquete del monorepo, manifest, instalación global + activación por usuario/grupo).
2. Cuándo se usa / cuándo no.
3. Entradas mínimas (intake) y preguntas al usuario: idea, necesidad, funcionalidades, concepto, ejemplos de apps, nombre, icono/logo y propiedades del manifest.
4. Fases con entradas, salidas, artefactos y responsables: intake, ejemplos, identidad/manifest, análisis y enriquecimiento, cierre de requisitos, puerta «¿empezamos el spec?», spec + mockup, cierre.
5. Puertas de usuario (requisitos, spec/mockup, aceptación, merge) alineadas con `agents.md`.
6. Stop conditions por dependencia no implementada.
7. Checklist de cierre y errores comunes.
8. Referencias.

Mantener el flujo de 10 pasos como tabla-resumen canónica. No duplicar el contrato del manifest: enlazar `docs/ai/module-system.md`.

Expected: el documento permite a un agente sin contexto previo saber qué preguntar, qué artefactos producir, en qué orden y cuándo parar.

- [ ] **Step 3: Verificar rutas y enlaces**

Run: `rg -n "TODO|esqueleto" docs/flows/new-module.md`
Expected: solo los `TODO` que dependen del Core, cada uno con su stop condition asociada; ninguno huérfano.

Run: comprobar que cada ruta citada existe (por ejemplo con un bucle `for f in ...; do test -f "$f"; done` o lectura directa).
Expected: todas las rutas existen; las que no, se corrigen o se marcan como pendientes de crear.

- [ ] **Step 4: Autorevisión y paso a `test`**

Revisar contra `docs/ai/module-system.md`, `feature.md` y `agents.md`. Actualizar `task-02.md` con la bitácora y `estado: test`.

Expected: sin contradicciones; el revisor de tarea (segundo agente) recibe el diff y la lista de verificación.

---

### Task 3 — sprint-08-task-03: Skill `new-module` + plantillas + dry-run

**Files:**
- Create: `.opencode/skills/new-module/SKILL.md`
- Create: `.opencode/skills/new-module/templates/manifest.json`
- Create: `.opencode/skills/new-module/templates/module-spec.md`
- Create: `.opencode/skills/new-module/templates/state.md`
- Modify: `docs/tasks/sprint-08-new-module-skill/task-03.md` (bitácora RED/GREEN y estado)

**Interfaces:**
- Consumes: `docs/ai/module-system.md`, `docs/flows/new-module.md` y el contrato §3.
- Produces: skill que se dispara cuando el usuario pide crear un módulo; plantillas que el agente copia y rellena. No produce código de producto.

- [ ] **Step 1: RED — escenario base sin skill**

Despachar un subagente con contexto inyectado (`docs/ai/module-system.md`, `docs/flows/new-module.md`, `feature.md`) y la petición «crea el módulo family-calendar». Instrucción: no escribir ficheros, solo plan. Registrar en `task-03.md`: qué hizo, qué se saltó, qué inventó, qué preguntas omitió. El módulo es ficticio y temporal; no se commitea.

Expected: comportamiento base documentado con citas literales de las racionalizaciones. Si el agente base ya cumple todo, no hay nada que enseñar: se para y se replantea el alcance de la skill.

- [ ] **Step 2: GREEN — escribir la skill mínima**

Crear `SKILL.md` con:
- `name: new-module`.
- `description` en inglés, en tercera persona, que empiece por «Use when…» y describa el disparador (crear/planificar/scaffoldear un módulo), sin resumir el flujo.
- Cuerpo en inglés: overview, cuándo se usa/no se usa, flujo por fases enlazado a `docs/flows/new-module.md`, stop conditions, checklist del manifest y errores comunes.
- Enlaces a plantillas y a la documentación canónica; sin duplicar el contrato completo.

Crear `templates/manifest.json` con la forma del §3 (placeholders claros, sin valores que parezcan reales), `templates/module-spec.md` con el esqueleto de spec del módulo y `templates/state.md` para el estado reanudable.

Expected: la skill corrige los fallos observados en RED; el agente base ahora pide spec y no inventa Core.

- [ ] **Step 3: GREEN — verificar con escenario**

Repetir el escenario con la skill presente (subagente con el `SKILL.md` en contexto). Registrar el comportamiento: ¿pidió idea, ejemplos, identidad y manifest?, ¿analizó y enriqueció?, ¿detectó contradicciones?, ¿cerró requisitos?, ¿preguntó si empezar el spec?, ¿generó spec + mockup?, ¿se detuvo en dependencias ausentes?, ¿usó las plantillas?

Expected: cumple los criterios de aceptación de task-03. Si aparece una racionalización nueva, volver a Step 2 (REFACTOR) y repetir.

- [ ] **Step 4: Autorevisión y paso a `test`**

Comprobar: frontmatter válido, descripción con disparador, enlaces existentes, plantillas coherentes con §3. Actualizar `task-03.md` con la evidencia y `estado: test`.

Expected: skill lista para revisión de segundo agente; sin valores de secretos.

---

### Task 4 — sprint-08-task-04: Entradas por proveedor

**Files:**
- Modify: `AGENTS.md` (sección de módulos, regla de actualización, fila en la tabla de obligaciones y check de commit)
- Create: `CLAUDE.md` (entrada para Claude con `@AGENTS.md` y punteros)
- Create: `.claude/skills/new-module/SKILL.md` (envoltorio fino)
- Create: `.agents/skills/new-module/SKILL.md` (opcional/futuro)
- Modify: `docs/tasks/sprint-08-new-module-skill/task-04.md` (bitácora y estado)

**Interfaces:**
- Consumes: `docs/ai/module-system.md`, `docs/flows/new-module.md`, `.opencode/skills/new-module/SKILL.md`.
- Produces: entradas por proveedor que apuntan a la misma fuente canónica; regla de actualización en `AGENTS.md`.

- [ ] **Step 1: Actualizar `AGENTS.md`**

Añadir:
- Sección `Module contract changes` con la regla de §5.7 de la spec.
- Fila `module-contract` en la tabla de obligaciones por tipo de tarea.
- Check en la checklist antes de cada commit: si cambió el contrato del módulo, actualizar `docs/ai/module-system.md`, el esquema y los envoltorios.
- Puntero a `docs/ai/module-system.md` y a la skill.

Expected: `AGENTS.md` sigue siendo el contrato compartido; no duplica el contrato completo.

- [ ] **Step 2: Crear `CLAUDE.md`**

Contenido mínimo:
```markdown
@AGENTS.md

Para crear un módulo, lee `docs/ai/module-system.md` y usa `.claude/skills/new-module/SKILL.md`.
```

Expected: Claude tiene una entrada clara y no duplica el contrato.

- [ ] **Step 3: Crear los envoltorios**

Crear `.claude/skills/new-module/SKILL.md` y `.agents/skills/new-module/SKILL.md` con:
- Frontmatter `name: new-module` y `description` en inglés con el disparador.
- Cuerpo breve: leer `docs/ai/module-system.md` y `docs/flows/new-module.md`; ejecutar el flujo; no avanzar sin la fuente canónica; usar las plantillas de `.opencode/skills/new-module/templates/`.

Expected: los tres proveedores comparten la misma fuente; no hay copias del contrato.

- [ ] **Step 4: Verificar punteros**

Run: comprobar que `AGENTS.md`, `CLAUDE.md`, `.opencode/skills/new-module/SKILL.md`, `.claude/skills/new-module/SKILL.md` y `.agents/skills/new-module/SKILL.md` citan `docs/ai/module-system.md`.
Expected: todos los punteros existen y son correctos.

- [ ] **Step 5: Autorevisión y paso a `test`**

Revisar coherencia con `AGENTS.md` y `CLAUDE.md`; actualizar `task-04.md` con la bitácora y `estado: test`.

Expected: sin contradicciones; el revisor de tarea recibe el diff.

---

### Task 5 — sprint-08-task-05: Check de CI + plantilla de PR

**Files:**
- Create: `scripts/check-ai-docs.mjs`
- Modify: `.github/workflows/ci.yml` (job o step nuevo)
- Create: `.github/pull_request_template.md`
- Modify: `docs/tasks/sprint-08-new-module-skill/task-05.md` (bitácora y estado)

**Interfaces:**
- Consumes: `docs/ai/manifest.schema.json`, `docs/ai/module-system.md`, `AGENTS.md`, `CLAUDE.md`, envoltorios.
- Produces: check que falla si la versión del manifest no coincide o si un puntero no apunta a la fuente canónica; plantilla de PR con el checkbox de actualización.

- [ ] **Step 1: Escribir el check**

`scripts/check-ai-docs.mjs` debe:
- Leer `manifest_version` del esquema y de `docs/ai/module-system.md`; fallar si no coinciden.
- Comprobar que `AGENTS.md`, `CLAUDE.md`, `.opencode/skills/new-module/SKILL.md`, `.claude/skills/new-module/SKILL.md` y `.agents/skills/new-module/SKILL.md` citan `docs/ai/module-system.md`.
- Salir con código 0 si todo está bien; 1 con un mensaje claro si falla.

Expected: el script falla cuando debe fallar y pasa cuando debe pasar; se prueba con un cambio temporal en la versión o en un puntero.

- [ ] **Step 2: Añadir el check a CI**

Añadir un job o step a `.github/workflows/ci.yml` que ejecute `node scripts/check-ai-docs.mjs`. Mantener `permissions: contents: read` y no inyectar secretos.

Expected: el check corre en PR y en `main`; falla si la documentación se desincroniza.

- [ ] **Step 3: Crear la plantilla de PR**

`.github/pull_request_template.md` con:
- Resumen del cambio.
- Checkbox: «Si cambié el contrato del módulo, actualicé `docs/ai/module-system.md`, el esquema y los envoltorios».
- Checklist de pruebas y seguridad.

Expected: la plantilla recuerda la regla; no sustituye al check.

- [ ] **Step 4: Autorevisión y paso a `test`**

Revisar que el check no imprime secretos y que el PR template no contradice `AGENTS.md`. Actualizar `task-05.md` con la bitácora y `estado: test`.

Expected: check y plantilla listos para revisión de segundo agente.

---

### Task 6 — sprint-08-task-06: Integración y validación final

**Files:**
- Modify: `docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md` (vía paralela)
- Modify: `docs/superpowers/specs/2026-10-26-modulo-system.md` (referencia a la metodología y la skill; sin tocar el contrato)
- Modify: `docs/flows/agents.md` y `docs/flows/feature.md` (enlaces que falten)
- Modify: `docs/tasks/sprint-08-new-module-skill/README.md` y `task-06.md` (estado y bitácora)
- Modify: `docs/tasks/sprint-08-new-module-skill/task-01..05.md` (estados finales)

**Interfaces:**
- Consumes: todos los artefactos de las tareas 1–5.
- Produces: referencias cruzadas correctas; roadmap con la vía paralela; sprint listo para `finalizada`.

- [ ] **Step 1: Añadir la vía paralela al roadmap**

En `docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md`, añadir `sprint-08-new-module-skill` como vía de documentación/tooling en paralelo: consume el contrato §3; no bloquea al Core; las fases ejecutables se verifican cuando exista el instalador.

Expected: el roadmap deja claro que no es una dependencia del Core ni un sprint de producto.

- [ ] **Step 2: Actualizar referencias y mapa de docs**

Sustituir en la spec de módulos la referencia «`new-module.md` (esqueleto a completar)» por la metodología + skill. Revisar `AGENTS.md` (mapa de docs) y `docs/flows/agents.md`/`feature.md` para enlazar la skill donde corresponda. No cambiar el contrato ni el contenido normativo de la spec.

Expected: todos los enlaces apuntan a ficheros existentes; sin contradicciones.

- [ ] **Step 3: Verificación final del sprint**

Run: `pnpm lint && pnpm tsc && pnpm test` (desde la raíz; si el cambio es solo docs, sirve como no-regresión).
Expected: en verde con la salida leída. Si algún comando no aplica, se anota el motivo en la tarea.

Run: `node scripts/check-ai-docs.mjs`
Expected: en verde.

Run: comprobar enlaces relativos de los ficheros tocados.
Expected: sin enlaces rotos.

- [ ] **Step 4: Revisión de segundo agente y cierre**

Revisión de coherencia (DoD de Docs) y auditoría de seguridad si el texto toca secretos o configuración sensible. Actualizar las seis tareas a `finalizada` solo tras resolver los hallazgos. El PR del sprint se pasa a listo con la orden del usuario.

Expected: DoD de Docs cumplido; PR en verde.
