# Flujo: nuevo módulo (metodología para agentes)

> **Estado: metodología v1** (sprint 08). Fuente canónica del contrato:
> [`docs/ai/module-system.md`](../ai/module-system.md). La skill de proyecto `new-module`
> (`.opencode/skills/new-module/SKILL.md`) ejecuta este flujo paso a paso; este documento es
> la metodología. Los `TODO` marcan piezas que dependen del Core: la skill debe **detectarlas
> y detener al agente**, no inventarlas. Un módulo es una tarea de tipo **feature** (con DDL):
> sigue [`feature.md`](feature.md) completo y añade lo de abajo. Roles y puertas:
> [`agents.md`](agents.md).

## 1. Cuándo se usa

- **Sí**: el usuario pide crear, planificar o definir un módulo nuevo.
- **No**: cambios dentro de un módulo existente (usa `feature.md` o `bugfix.md`) ni cambios
  del Core (usa el flujo del Core).
- **No** si lo que se pide es una pantalla, un recurso o una tabla transversal que pertenece
  al Core: primero se decide si es módulo o Core con la spec §4. Un módulo no reabre el Core.

## 2. Roles y puertas

- **Orquestador:** conversa con el usuario, conduce la metodología, redacta la spec y el plan,
  arma el contexto de los subagentes y marca `test` y `finalizada`.
- **Implementador:** ejecuta la tarea con TDD en un solo bucle y marca `en curso` al arrancar.
- **Revisor de tarea, QA, estilo y auditor de seguridad:** nunca el autor; la auditoría de
  seguridad es incondicional y no se fusiona con QA ni estilo.
- **Traductor:** rellena locales cuando falten.

**Puertas del usuario:** requisitos cerrados, «¿empezamos el spec?», spec + mockup aceptados,
plan aprobado, UI aceptada (si aplica), aceptación del resultado y orden de merge. Cada puerta
se respeta; sin ella no se avanza.

## 3. Flujo de la skill (resumen canónico)

| # | Paso | Artefacto | Puerta |
|---|---|---|---|
| 1 | **Intake**: idea, necesidad, funcionalidades y concepto general | `state.md` con el brief | — |
| 2 | **Ejemplos**: apps que hagan algo igual o similar | lista de referencias y patrones | — |
| 3 | **Identidad y manifest**: nombre, icono/logo y propiedades requeridas | propuesta de identidad + manifest borrador | — |
| 4 | **Análisis y enriquecimiento**: propuesta enriquecida, mejoras, encaje con el proyecto, entidades y Core; puntos mal definidos o contradictorios | análisis con decisiones y dudas | — |
| 5 | **Cierre de requisitos**: congelar alcance y resolver contradicciones | `state.md` actualizado | **Requisitos cerrados** |
| 6 | **¿Empezamos el spec?** | — | **Sí/No explícito** |
| 7 | **Spec + mockup**: spec completa (seguridad, API, MCP, tests) y mockup HTML+JS de móvil y panel; iterar hasta aceptación | spec en `docs/superpowers/specs/<fecha>-<key>.md` y mockup en `docs/mockups/<key>/index.html` | **Spec + mockup aceptados** |
| 8 | **Plan**: ficheros exactos, comandos, tests y criterios de aceptación | plan en `docs/superpowers/plans/<fecha>-<key>.md` | **Plan aprobado** |
| 9 | **Implementación**: scaffold, TDD, revisión/auditoría y, si el Core existe, install/activate | código, tests y docs del módulo | **UI aceptada** (si aplica) |
| 10 | **Aceptación y merge** | PR y módulo cerrado | **Aceptación + orden de merge** |

## 4. Detalle por fase

### Fase 1 — Intake

**Objetivo:** entender la idea antes de escribir nada. **Salida:** brief en `state.md`.

Pregunta al usuario:

- ¿Cuál es la idea del módulo?
- ¿Qué necesidad cubre?
- ¿Qué funcionalidades debe tener?
- ¿Cuál es el concepto general?

No preguntes lo que ya está en la spec del sistema de módulos. Pregunta solo lo que la spec
deja al usuario (producto, alcance, prioridad, aceptación). Si el usuario no concreta la
necesidad o el alcance, **no avances**.

### Fase 2 — Ejemplos

**Objetivo:** aprender de soluciones existentes. **Salida:** lista de apps y patrones.

- ¿Hay apps que hagan algo igual o similar?
- ¿Qué hacen bien y qué hacen mal?
- ¿Qué patrones se pueden reutilizar y cuáles no encajan con 027Apps?

Si no hay ejemplos, pide referencias o propone dos o tres y valida con el usuario.

### Fase 3 — Identidad y manifest

**Objetivo:** proponer la identidad y el borrador del manifest. **Salida:** propuesta para
debatir.

- Pregunta nombre, icono/logo y las propiedades requeridas del manifest.
- Propón valores por defecto con motivo: `key` kebab-case, `name` en inglés, `branding`
  (descripción, icono SVG monocromo y color de los 8 slots del DS), `is_public`, `version`.
- Valida el borrador contra [`docs/ai/manifest.schema.json`](../ai/manifest.schema.json) y el
  contrato de [`docs/ai/module-system.md`](../ai/module-system.md).
- No rellenes capacidades que el módulo no use; cada capacidad declarada exige su documento.

### Fase 4 — Análisis y enriquecimiento

**Objetivo:** convertir la idea en una propuesta profesional. **Salida:** análisis con
decisiones y dudas.

- Analiza la idea y los ejemplos; saca conclusiones.
- Propón una idea enriquecida con todas las características y sugiere mejoras para debatir.
- Revisa el encaje con el proyecto, sus entidades y el Core (participantes, grupos, permisos,
  realtime, notificaciones, API, MCP).
- Detecta puntos mal definidos, contradictorios o problemáticos, y propón alternativas.
- Registra las decisiones y las dudas abiertas en `state.md`.

**Stop condition:** si el módulo necesita una capacidad del Core que no existe y el usuario no
acepta entregarlo en modo «spec + dominio» sin esa capacidad, se para y se replantea.

### Fase 5 — Cierre de requisitos

**Objetivo:** congelar el alcance. **Salida:** `state.md` con requisitos cerrados.

- Resuelve las contradicciones y las dudas abiertas con el usuario.
- Confirma límites de v1 y no-objetivos.
- Confirma tablas y datos, pantallas/UI y páginas de admin, scopes y tools MCP, settings y
  secretos, eventos y canales, locales, moneda/fechas si aplica e `is_public`.
- Registra las dependencias del Core y su estado real (`implementada` / `pendiente`).

**Puerta:** el usuario confirma que los requisitos están cerrados. Sin esta puerta no se
genera el spec.

### Fase 6 — Puerta: ¿empezamos el spec?

Pregunta explícitamente: «¿Empezamos el spec?». Si el usuario dice no, guarda `state.md` y
detente. Si dice sí, continúa.

### Fase 7 — Spec + mockup

**Objetivo:** spec aprobada y mockup aceptado. **Plantillas:**
`.opencode/skills/new-module/templates/module-spec.md` y `state.md`.

**Contenido mínimo de la spec:**

- Problema, límites de v1 y no-objetivos.
- Modelo de datos: tablas con `group_id`, RLS, referencias a `participants` (nunca `profiles`),
  migraciones `up`/`down` reversibles; el `down` no borra dinero.
- Superficie: API `/api/v1` (endpoints, métodos, esquemas, errores, paginación, filtros,
  idempotencia, scopes y rate limits), settings, i18n, tools MCP (`kind` + scopes), eventos y
  canales, páginas de admin y hooks.
- Seguridad: modelo de amenazas, authz, RLS, validación zod, secretos, datos familiares,
  auditoría y dependencias.
- Tests: dominio, API, RLS, integración, MCP, migraciones, E2E y seguridad.
- Documentación por capacidad.
- Criterios de aceptación verificables.

**Mockup:** artefacto HTML+JS en `docs/mockups/<key>/` con vista móvil y vista del panel de
administración. Debe visualizar la idea y los flujos principales. Se itera con el usuario
hasta que ambos lo acepten. **La spec no está completa hasta que el mockup se acepta.**

**Verificación:** coherencia con el contrato de `docs/ai/module-system.md` y con `feature.md`.

**Puerta:** el usuario aprueba la spec y el mockup. Sin aprobación no hay plan ni código.

### Fase 8 — Plan

**Objetivo:** plan en `docs/superpowers/plans/<fecha>-<key>.md` con ficheros exactos,
comandos, tests y criterios de aceptación. **Verificación:** cubre todos los requisitos de la
spec. **Puerta:** el usuario aprueba el plan.

### Fase 9 — Implementación

**Scaffold:** `packages/<key>/` con `manifest.json`, DDL `up`/`down`, settings, locales,
documentos por capacidad y esqueleto de UI. El contrato del manifest se consulta en
[`docs/ai/module-system.md`](../ai/module-system.md); no se duplica aquí.

**TDD:** dominio puro primero (dinero con unidades menores, redondeo determinista, suma de
reparto == total, casos de uso con repositorios inyectados), después schemas zod en los bordes,
después API/UI cuando exista el Core. Un solo agente ejecuta el bucle rojo → verde → refactor.

**Revisión y auditoría:** revisión de tarea (segundo agente) contra spec y plan; QA con ojos
nuevos; revisor de estilo; **auditoría de seguridad OWASP incondicional** y específica (RLS en
todas las tablas, accesos cruzados, scopes mínimos, tools `write` no expuestas, secretos
cifrados). Críticos/altos sin resolver bloquean `finalizada`.

**Instalación y activación (cuando exista el Core):** validar el manifest, verificar digests,
aplicar migraciones `up` en transacción, sembrar settings/i18n y registrar. Activar/desactivar
sin tocar DDL; desinstalar revierte `down`, limpia settings/translations con
`source: module:<key>` y borra el registry. Confirmación explícita del super_admin del diff del
DDL antes de install/uninstall.

**Stop condition:** si falta una pieza del Core (registry, suite RLS, DS, i18n, instalador,
API, shell del admin), no inventes stubs ni endpoints provisionales. Entrega lo verificable y
reporta; el módulo queda en `test` con la lista de bloqueos.

### Fase 10 — Aceptación y merge

- El usuario acepta la UI/el resultado en preview o APK (si aplica).
- Merge con orden explícita; squash; `main` desplegable.
- Cierre: verificar despliegue y pasar la tarea a `finalizada`.

## 5. Stop conditions por dependencia del Core

| Dependencia | Cómo detectarla | Qué hace el agente |
|---|---|---|
| Esquema zod + script de registry | no existe en `packages/` ni en scripts | escribe el manifest contra el contrato; validación mecánica **bloqueante** |
| Suite de tests RLS | no existe | escribe los tests de aislamiento; no los ejecuta contra una BD inexistente |
| Componentes del DS + Storybook | no existen | no implementa UI; entrega spec + dominio + API sin UI |
| Pipeline `i18n:scan`/`i18n:check` | no existe | escribe claves y locales; verificación **bloqueante** |
| Instalador en runtime | no existe | no declara install/activate/uninstall |
| API `/api/v1` del Core | no existe | no implementa endpoints dependientes; dominio puro + schemas |
| Shell del admin | no existe | no implementa `admin_pages` |

**Regla:** un módulo no se marca `finalizada` mientras una capacidad declarada en su manifest
no tenga su verificación real. Se marca `test` con la lista de bloqueos y se reporta.

## 6. Checklist de cierre

- [ ] Requisitos cerrados y spec + mockup aprobados por el usuario.
- [ ] Plan aprobado con ficheros, comandos, tests y criterios de aceptación.
- [ ] `packages/<key>/manifest.json` cumple el contrato de `docs/ai/module-system.md`, sin
      placeholders y con digests calculados.
- [ ] DDL `up`/`down` reversibles; `group_id` en todas las tablas; RLS; referencias a
      `participants`, nunca `profiles`.
- [ ] Settings con categoría `snake_case(key)`; `is_secret` cifrado; sin secretos en el manifest.
- [ ] i18n: inglés como clave; locales del set; `i18n:check` en verde.
- [ ] Tools MCP con `kind` y scopes; las `write` no se exponen por defecto.
- [ ] Eventos y canales coherentes; `members_fn` security definer.
- [ ] Páginas de admin de un segmento, componente en su ruta y rol correcto.
- [ ] Documentación por capacidad; cada nombre declarado aparece en su documento.
- [ ] Tests: dominio, contrato del manifest, aislamiento RLS, i18n.
- [ ] Auditoría de seguridad OWASP con críticos/altos resueltos.
- [ ] Instalación/activación/desinstalación probadas (cuando exista el instalador).
- [ ] Aceptación del usuario y orden de merge.

## 7. Errores comunes (observados en el escenario base)

1. Empezar por el código sin requisitos cerrados ni spec aprobada.
2. Saltarse la pregunta «¿empezamos el spec?».
3. Inventar registry, instalador o suite RLS «provisionales».
4. Poner `group_id` solo en algunas tablas.
5. Referenciar `profiles` en vez de `participants`.
6. Sembrar scopes en BD (viven en código).
7. Usar colores hex libres en `branding.color`.
8. Olvidar el `down` o los digests de las migraciones.
9. Declarar capacidades sin su documento asociado.
10. Exponer tools MCP `write` por defecto.
11. Marcar `finalizada` con capacidades bloqueadas por el Core.
12. Generar el spec sin el mockup aceptado.

## 8. Referencias

- Contrato canónico: [`docs/ai/module-system.md`](../ai/module-system.md)
- Esquema del manifest: [`docs/ai/manifest.schema.json`](../ai/manifest.schema.json)
- Spec del sistema de módulos: `docs/superpowers/specs/2026-10-26-modulo-system.md` §3–§4, §10
- Spec de diseño: `docs/superpowers/specs/2026-10-24-027apps-design.md` §4, §9, §11
- Feature base: `docs/flows/feature.md` · Roles y puertas: `docs/flows/agents.md`
- i18n: `docs/flows/i18n.md` · CI/migraciones: `docs/flows/cicd.md`
- DoD: `docs/conventions/definition-of-done.md` · Seguridad: `docs/conventions/security-checklist.md`
- ADRs: `0004` (bordes), `0007` (errores), `0008` (fechas/moneda), `0009` (realtime)
- Skill y plantillas: `.opencode/skills/new-module/`
