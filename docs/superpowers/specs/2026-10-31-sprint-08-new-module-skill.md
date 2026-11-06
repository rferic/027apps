# Spec — Sprint 08: metodología y skill `new-module`

**Fecha:** 2026-10-31
**Estado:** Aprobada por el usuario (2026-10-31)
**Sprint:** `sprint-08-new-module-skill`
**Ámbito:** documentación y tooling; sin código de producto
**Contrato base:** `docs/superpowers/specs/2026-10-26-modulo-system.md` §3, aprobado por el usuario (2026-10-31)
**Plan:** `docs/superpowers/plans/2026-10-31-sprint-08-new-module-skill.md`

## 1. Objetivo

Dejar documentado, para cualquier agente, cómo se define y se crea un módulo de 027Apps: contrato del `manifest.json`, propiedades, requisitos, ciclo de vida y reglas de seguridad, API, MCP y testing. Además, crear la skill de proyecto `new-module` que ejecute la metodología: preguntar, analizar, enriquecer, cerrar requisitos, generar mockup y spec, y detenerse cuando falte una pieza del Core.

La skill **no implementa** módulos, el instalador, el registry ni el Core. Es una guía con plantillas y puertas explícitas.

## 2. Alcance y no alcance

**Entra:**

- Documentación canónica para IA: contrato del manifest, propiedades, requisitos, ciclo de vida y reglas transversales.
- Esquema legible por máquina del manifest.
- Regla de actualización en `AGENTS.md` y `CLAUDE.md`.
- Envoltorios por proveedor (OpenCode, Claude, futuro Codex/otros).
- Metodología en `docs/flows/new-module.md`.
- Skill `new-module` + plantillas.
- Check de CI barato: versión del manifest + punteros a la fuente canónica.
- Prueba de la skill con un módulo ficticio temporal.
- Plantilla de PR y checklist de commit.

**No entra:**

- Implementar módulos, el instalador, el registry, la suite RLS o el Core.
- Generar código de producto de forma automática en v1.
- Cambiar el contrato del manifest §3.
- Traducir la documentación interna.

## 3. Decisiones

1. **Multi-proveedor:** fuente canónica + envoltorios finos. Las reglas viven una sola vez en `docs/ai/module-system.md`; cada `SKILL.md` apunta a ella. Sin duplicación.
2. **Idioma:** se respeta `AGENTS.md`: documentación en `docs/` y `AGENTS.md`/`CLAUDE.md` en español. La skill se escribe en inglés por ser herramienta para agentes. Traducción posterior si se decide.
3. **Módulo de prueba:** ficticio y temporal; no se commitea. Se documenta el resultado en la tarea.
4. **Puerta “¿empezamos el spec?”:** después de congelar requisitos y antes de generar spec + mockup.
5. **Contrato §3:** aprobado tal cual. Cualquier cambio posterior exige reabrir la spec del sistema de módulos.
6. **Core:** no es dependencia del sprint. Es condición de parada cuando se ejecute un módulo real.
7. **Check de CI:** solo versión del manifest + punteros. Sin check por rutas.
8. **Worktree:** se crea al arrancar la implementación, no al redactar esta spec. Nombre: `sprint-08-new-module-skill`.

## 4. Artefactos y estructura multi-proveedor

```text
AGENTS.md                              # contrato compartido; sección de módulos + regla de actualización
CLAUDE.md                              # entrada para Claude: @AGENTS.md + punteros
docs/ai/module-system.md               # fuente única de verdad (contrato, requisitos, reglas)
docs/ai/manifest.schema.json           # esquema legible por máquina
docs/flows/new-module.md               # metodología: fases, preguntas, puertas, artefactos
.opencode/skills/new-module/SKILL.md   # skill para OpenCode
.claude/skills/new-module/SKILL.md     # skill para Claude
.agents/skills/new-module/SKILL.md     # opcional/futuro para otros proveedores
.opencode/skills/new-module/templates/ # manifest.json, module-spec.md, state.md
scripts/check-ai-docs.mjs              # check de versión + punteros (o equivalente)
```

**Regla de no duplicación:** el contrato completo no se copia en cada `SKILL.md`. Cada envoltorio contiene metadatos y una instrucción explícita: leer `docs/ai/module-system.md` y `docs/flows/new-module.md`, ejecutar el flujo y no avanzar sin la fuente canónica.

## 5. Documentación canónica para IA

`docs/ai/module-system.md` debe contener:

### 5.1 Contrato del manifest

- Enlace a `docs/ai/manifest.schema.json`.
- Ejemplo completo y ejemplos mínimos.
- Propiedades: `key`, `name`, `branding`, `version`, `is_public`, `migraciones`, `settings`, `i18n`, `scopes`, `mcp_tools`, `channels`, `eventos`, `hooks`, `admin_pages`, `docs`.
- Invariantes del §3, sin reinterpretarlos.
- Regla de negocio: el manifest no declara rutas HTTP de `/api/v1`; solo DDL, settings, tools/eventos/hooks y scopes para validación mecánica.

### 5.2 Propiedades y requisitos

- Estructura del paquete: `packages/<key>/`, `manifest.json`, `sql/`, `docs/`, `admin/`, `locales/`, `src/`.
- Documentación por capacidad: `README.md` obligatorio; `api` si hay scopes; `mcp` si hay tools; `settings` si hay settings; `events` si hay eventos/canales.
- DDL `up`/`down` con digests; migraciones reversibles.
- Settings completos: `key`, `type`, `default`, `label`/`help` en inglés, `is_public`, `is_secret`, `mcp_access`, `sort_order`.
- Branding: SVG monocromo con `currentColor`, safe-zone 24/48 px; color entre los 8 slots del DS; nunca hex libre.
- Páginas de admin: ruta de un segmento, label en inglés, icono del DS, grupo `module`, rol `admin`/`super_admin`; componente en `packages/<key>/admin/<route>/page.tsx`.
- Scopes `recurso:acción`; viven en código; no se siembran en BD.
- Tools MCP con `kind` (`read`/`write`), descripción en inglés y scopes; `mcp_exposed = read` bloquea las de `write`.
- Canales con `pattern` y `members_fn`; eventos con `type`, `target` y `notify` opcional.
- Hooks a eventos del Core o del propio módulo.

### 5.3 Ciclo de vida

- Instalar → activar → desactivar → desinstalar.
- Instalación global por instancia; activación por usuario/grupo.
- Migraciones `up` en orden y transacción; rollback si falla.
- Siembra de settings, i18n y traducciones; los scopes no se siembran.
- Limpieza de settings y datos al uninstall según el contrato.
- El módulo no se sirve si no está `active`.

### 5.4 Seguridad

La documentación debe exigir, para cada módulo:

- Modelo de amenazas: activos, actores, límites de confianza, casos de abuso.
- Autenticación y autorización: roles de familia, `admin`/`super_admin`, scopes, matriz de permisos.
- RLS y aislamiento entre familias/grupos; tests de acceso cruzado.
- Validación zod en los bordes de API; prevención de inyección; codificación de salida.
- Secretos: nunca en código; gestor de secretos; cifrado; rotación.
- Datos personales/familiares: cifrado en tránsito y reposo; retención; exportación; borrado; backups.
- API: JWT corto + refresh; scopes; rate limits; idempotencia; envelope de errores sin fugas; CORS/CSRF cuando aplique.
- MCP: autorización por herramienta, scopes, auditoría, límites, sin secretos en respuestas, efectos secundarios declarados.
- Auditoría: quién hizo qué y cuándo; logs inmutables; retención.
- Dependencias: versiones fijadas; sin vulnerabilidades conocidas.
- Puerta de auditoría de seguridad antes de implementar, por un agente distinto del autor. Hallazgos críticos/altos bloquean.

### 5.5 Tests

- Dominio: tests unitarios con TDD (rojo → verde → refactor).
- API: tests de contrato con zod, códigos de estado y envelope de errores.
- RLS: suite de aislamiento entre familias/grupos.
- Integración: límites con el Core, casos de uso y puertas delgadas.
- MCP: autorización, entrada/salida y efectos secundarios.
- Migraciones: `up` y `down`, idempotencia y rollback.
- E2E: flujos críticos de móvil y panel cuando exista UI.
- Seguridad: bypass de autorización, inyección, rate limits y fuga de datos.
- Criterios de aceptación y cobertura esperada.

### 5.6 API y MCP

- API-first: todo cliente habla con `/api/v1`; nunca con la BD.
- Contrato de API: endpoints, métodos, esquemas de entrada/salida, envelope de errores, paginación, filtros, idempotencia, versionado, scopes y rate limits.
- MCP: el spec define si el módulo expone tools/resources; nombre, descripción, esquema de entrada/salida, scopes, efectos secundarios, idempotencia y límites. El manifest declara las tools; la documentación por capacidad las describe. MCP es opt-in y respeta permisos.
- Seguridad MCP: autorización por herramienta, auditoría, sin secretos en respuestas, límites de uso.

### 5.7 Regla de actualización

Cualquier cambio en el contrato del manifest, el ciclo de vida o el flujo de creación debe actualizar, en el mismo PR:

- `docs/ai/module-system.md`
- `docs/ai/manifest.schema.json` (si cambia el esquema)
- la sección de módulos de `AGENTS.md` y el puntero de `CLAUDE.md`
- los envoltorios de proveedor
- los ejemplos si cambia la forma

Un cambio solo de código que deje la documentación de IA desactualizada está incompleto.

## 6. Flujo de la skill

La skill ejecuta estas fases. No avanza sin confirmación explícita del usuario.

1. **Intake.** Preguntar idea del módulo, necesidad que cubre, funcionalidades y concepto general. Registrar en `state.md`.
2. **Ejemplos.** Preguntar si hay apps que hagan algo igual o similar; si no, pedir referencias. Extraer patrones y diferencias.
3. **Identidad y manifest.** Preguntar nombre, icono/logo y propiedades requeridas del manifest. Proponer valores por defecto y validar contra el esquema.
4. **Análisis y enriquecimiento.** Analizar idea + ejemplos; proponer una idea enriquecida con todas las características; sugerir mejoras para debatir; revisar encaje con el proyecto, sus entidades y el Core; detectar puntos mal definidos, contradictorios o problemáticos. Registrar decisiones y dudas.
5. **Cierre de requisitos.** Congelar el alcance; resolver contradicciones; actualizar `state.md`.
6. **Puerta: ¿empezamos el spec?** Preguntar explícitamente. Si el usuario dice no, parar y dejar el estado.
7. **Spec + mockup.** Generar la spec del módulo y un mockup HTML+JS como artefacto (`docs/mockups/<key>/index.html`), con vista móvil y panel de administración. El spec no está completo hasta que el mockup se acepte. Iterar hasta acuerdo.
8. **Cierre.** Validar el manifest contra el esquema; comprobar seguridad, API, MCP y tests; actualizar la documentación canónica si cambió el contrato; dejar `state.md` con el siguiente paso.

**Plantillas:** manifest, spec de módulo y `state.md`. La skill no genera código de producto en v1.

## 7. Regla en `AGENTS.md` y `CLAUDE.md`

Añadir a `AGENTS.md` una sección `Module contract changes` con el texto de §5.7. Añadir una fila `module-contract` a la tabla de obligaciones por tipo de tarea y un check en la checklist antes de cada commit. Añadir el checkbox a la plantilla de PR.

`CLAUDE.md` será un puntero corto:

```markdown
@AGENTS.md

Para crear un módulo, lee `docs/ai/module-system.md` y usa `.claude/skills/new-module/SKILL.md`.
```

Los envoltorios de proveedor contendrán metadatos y la instrucción de leer la fuente canónica. No duplicarán el contrato.

## 8. Validación con módulo ficticio

Se usará un módulo ficticio temporal (por ejemplo, `family-calendar`) para probar la skill. No se commitea. El dry-run debe producir:

- brief con idea, necesidad, funcionalidades y concepto;
- ejemplos y conclusiones;
- manifest propuesto y validado contra el esquema;
- lista de contradicciones/ambigüedades resueltas;
- mockup HTML+JS de móvil y panel;
- spec completa con seguridad, API, MCP y tests;
- matriz de dependencias del Core y stop conditions;
- `state.md` con el siguiente paso.

El resultado se documenta en la tarea. El dry-run no implementa el módulo.

## 9. Criterios de aceptación

- La documentación canónica existe y no contradice la spec del sistema de módulos §3.
- El esquema del manifest valida el ejemplo del §3 y los ejemplos mínimos.
- `AGENTS.md`, `CLAUDE.md` y los envoltorios apuntan a la misma fuente canónica.
- La skill pide idea, ejemplos, identidad y manifest; analiza y enriquece; detecta contradicciones; cierra requisitos; pregunta si empezar el spec; genera spec + mockup; exige seguridad, API, MCP y tests.
- La skill se prueba con el módulo ficticio y se documenta el resultado.
- El check de CI pasa: versión del manifest y punteros.
- Revisión de segundo agente en cada tarea; auditoría de seguridad si el texto toca secretos o configuración sensible.
- No se implementa ningún módulo, instalador, registry ni Core.

## 10. Riesgos

- **Deriva entre documentación y contrato:** se mitiga con la regla de actualización y el check de versión/punteros.
- **Agente que ignora el puntero:** se mitiga con envoltorios explícitos y una instrucción de “no avances sin la fuente canónica”.
- **Sobre-documentación:** la fuente canónica debe ser escaneable; el flujo no repite el contrato.
- **Falso positivo del dry-run:** si el agente base ya cumple todo, se replantea el alcance de la skill.
- **Confusión producto/tooling:** el módulo ficticio no se commitea y se marca como temporal.

## 11. Dependencias y stop conditions

- **Dependencia real:** contrato §3 aprobado. Ya está.
- **Stop conditions al ejecutar un módulo real:** falta el script de registry, la suite RLS, los componentes del DS, la pipeline i18n o el instalador en runtime. El agente para y reporta; no inventa stubs.
- **Core:** no bloquea este sprint. Corre en paralelo.

## 12. Referencias

- `docs/superpowers/specs/2026-10-26-modulo-system.md` §3–§4 y §10
- `docs/superpowers/specs/2026-10-24-027apps-design.md` §4 y §9/§11
- `docs/flows/feature.md`, `docs/flows/agents.md`, `docs/flows/new-module.md`
- `docs/conventions/definition-of-done.md` §Docs y §Código
- `docs/conventions/security-checklist.md`
- `AGENTS.md`
- `.opencode/skills/new-module/` (skill y plantillas)
