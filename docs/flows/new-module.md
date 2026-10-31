# Flujo: nuevo módulo (metodología para agentes)

> **Estado: metodología v1** (sprint 08). La skill de proyecto `new-module`
> (`.opencode/skills/new-module/SKILL.md`) ejecuta este flujo paso a paso; este documento es
> la fuente canónica. Los `TODO` marcan piezas que dependen del Core: la skill debe
> **detectarlas y detener al agente**, no inventarlas.
> Concepto de módulo: [spec de diseño §4 «Sistema de módulos»](../superpowers/specs/2026-10-24-027apps-design.md):
> paquete del monorepo (`packages/*`), instalación global por instancia y activación en el
> ámbito que fije la spec del sistema de módulos. Un módulo es una tarea de tipo **feature**
> (con DDL): sigue [`feature.md`](feature.md) completo y añade lo de abajo. Roles en
> [`agents.md`](agents.md).

## 1. Cuándo se usa

- **Sí**: el usuario pide crear, planificar o scaffol dear un módulo nuevo.
- **No**: cambios dentro de un módulo existente (usa `feature.md` o `bugfix.md`) ni cambios
  del Core (usa el flujo del Core).
- **No** si lo que se pide es una pantalla, un recurso o una tabla transversal que pertenece
  al Core: primero se decide si es módulo o Core con la spec §4. Un módulo no reabre el Core.

## 2. Entradas mínimas (intake)

Antes de escribir artefactos, confirma con el usuario lo que la spec no decide:

| Dato | Para qué | Si falta |
|---|---|---|
| `key` (kebab-case) y nombre | manifest, paquete, rutas | propone 2–3 opciones y pide decisión |
| Problema y límites de v1 | spec | no avances a la fase 1 |
| Tablas y datos | DDL y RLS | no avances a la fase 3 |
| Pantallas/UI y páginas de admin | alcance | no avances a la fase 3 |
| Scopes y tools MCP | contrato | no avances a la fase 3 |
| Settings y secretos | manifest y seguridad | no avances a la fase 3 |
| Eventos y canales | manifest | no avances a la fase 3 |
| Locales | i18n | no avances a la fase 3 |
| Moneda/fechas si aplica | ADR 0008 | no avances a la fase 1 |
| `is_public` por defecto | manifest | propone `false` y pide confirmación |

**No preguntes lo que ya está en la spec.** Pregunta solo lo que la spec deja al usuario
(producto, alcance, prioridad, aceptación).

## 3. Fases y puertas (resumen canónico)

| # | Paso | Ejecuta | Revisa / verifica | Decide el usuario |
|---|---|---|---|---|
| 1 | **Spec del módulo** (tablas, pantallas, límites de v1, permisos, tools MCP, eventos). Dependencias de Core registradas en la tarea | Orquestador | Coherencia con la spec de diseño y con las tareas de Core `finalizada` | **Puerta: aprueba la spec** (y los mockups de las pantallas clave: **puerta de diseño**) |
| 2 | **Manifest** `manifest.json` del módulo. El contrato (formato, ubicación, script de registry) lo fija la spec del sistema de módulos §3 | Implementador | Validación mecánica del manifest contra su esquema (script de registry) | — |
| 3 | **DDL con rollback**: migración del módulo + su rollback. Todas las tablas llevan `group_id` y RLS scoped al grupo; los módulos referencian `participants`, nunca `profiles`. Compatibilidad hacia atrás: [Migraciones en `cicd.md`](cicd.md#migraciones-supabase) | Implementador | Tests de aislamiento entre grupos (**TODO:** suite RLS del Core) | — |
| 4 | **Textos i18n**: inglés como clave, `locales/*.json` del módulo y `i18n:scan`/`i18n:check` en CI (9 locales del set; ver [`i18n.md`](i18n.md)) | Implementador + Traductor | `i18n:check` falla si falta/sobra una clave o cambian los placeholders | — |
| 5 | **Tools MCP** y scopes del módulo | Implementador | Contrato MCP y scopes por módulo (spec de API/tokens del Core) | — |
| 6 | **Eventos realtime** del módulo | Implementador | Contrato de canales y eventos en [`2026-10-26-realtime-notificaciones.md`](../superpowers/specs/2026-10-26-realtime-notificaciones.md) (ADR 0009): el módulo declara `channels` (`pattern` + `members_fn`) y `eventos` (`type`, `target`, `subject`, `notify`) en su manifest | — |
| 7 | **UI solo con el design system**: componentes del DS y tokens semánticos; nada de estilos ad-hoc ni colores hardcodeados ([`code-style.md`](../conventions/code-style.md#colores)). **TODO:** componentes base del DS y Storybook | Implementador | Lint de colores (mecánico) + revisor de estilo | **Puerta: acepta la UI** en el preview/APK |
| 8 | **Registro**: alta en el instalador. **TODO:** instalador del Core. La skill `new-module` (`.opencode/skills/new-module/`) automatiza el recorrido de los pasos 2–6 | Implementador | Validación del manifest y del DDL en CI | — |
| 9 | **Revisión de seguridad específica** además de la auditoría OWASP incondicional: RLS en todas las tablas, accesos cruzados entre grupos, scopes mínimos de las tools MCP, nada de dinero/tokens expuestos de más | Auditor de seguridad | Informe por escrito; críticos/altos bloquean | Ve el resumen del informe |
| 10 | **Aceptación y merge** como en [`feature.md`](feature.md) (pasos 9–11) | Orquestador | DoD de Código | **Puertas: aceptación del resultado y orden de merge** |

## 4. Detalle por fase

### Fase 0 — Intake (antes de la spec)

**Objetivo:** convertir la petición en datos verificables. **Salida:** respuestas del usuario
a la tabla §2 y una lista de dependencias del Core.

**Cómo lo hace el agente:**
1. Lee la spec del sistema de módulos §3–§4 y la spec de diseño §4.
2. Pregunta solo lo que falta; propone valores por defecto con motivo.
3. Registra en la tarea las dependencias del Core que el módulo consume y su estado real
   (`implementada` / `pendiente`).
4. Si el usuario no confirma el alcance, **no avances**.

**Stop condition:** el módulo necesita una capacidad del Core que no existe y el usuario no
acepta entregar el módulo en modo "spec + dominio" sin esa capacidad. Se para y se replantea.

### Fase 1 — Spec del módulo (puerta 1)

**Objetivo:** spec aprobada en `docs/superpowers/specs/<fecha>-<key>.md`. **Plantilla:**
`.opencode/skills/new-module/templates/module-spec.md`.

**Contenido mínimo:**
- Problema, límites de v1 y no-objetivos.
- Modelo de datos: tablas con `group_id`, RLS, referencias a `participants`, migraciones
  `up`/`down` reversibles; el `down` no borra dinero (spec §12).
- Superficie: API, settings (forma completa), i18n, tools MCP (`kind` + scopes), eventos y
  canales, páginas de admin, hooks.
- Seguridad: aislamiento entre grupos, scopes mínimos, secretos cifrados.
- Documentación por capacidad.
- Criterios de aceptación verificables.

**Verificación:** coherencia con §3/§4 de la spec del sistema de módulos y con `feature.md`.
**Puerta:** el usuario aprueba la spec y los mockups de las pantallas clave. Sin aprobación no
hay plan ni código.

### Fase 2 — Plan (puerta 2)

**Objetivo:** plan en `docs/superpowers/plans/<fecha>-<key>.md` con ficheros exactos,
comandos, tests y criterios de aceptación. **Verificación:** cubre todos los requisitos de la
spec. **Puerta:** el usuario aprueba el plan.

### Fase 3 — Scaffold del paquete

**Objetivo:** `packages/<key>/` con `manifest.json`, DDL `up`/`down`, settings, locales,
documentos por capacidad y esqueleto de UI. **Plantillas:** `templates/manifest.json`.

**Reglas del manifest (§3):**
- `key` único, kebab-case; no puede ser `admin`, `mcp`, `api` ni `core`.
- `name`/`label`/`help` en inglés (son claves i18n).
- `branding.color` ∈ los 8 slots del DS; nunca hex libre.
- Cada migración declara `up` y `down`; `version` única; `digest`/`down_digest` = SHA-256 del
  contenido.
- `settings[].category` = `snake_case(key)`; cada setting declara la forma completa.
- `scopes` con convención `recurso:acción`; viven en código, no se siembran en BD.
- Cada tool MCP declara `name`, `kind` (`read`/`write`), `description` y scopes declarados.
- Cada evento declara `type` y `target`; un `target` de canal exige `channels[].pattern`.
- `admin_pages[].route` de un solo segmento; componente en
  `packages/<key>/admin/<route>/page.tsx`; rol `admin` o `super_admin`.
- `docs`: `readme` obligatorio; `api` si hay `scopes`; `mcp` si hay `mcp_tools`; `settings` si
  hay `settings`; `events` si hay `eventos`/`channels`.

**Stop condition:** si no existe el esquema zod/registry, escribe el manifest contra §3 y deja
la validación mecánica como **bloqueante pendiente**. No crees un validador ad hoc que pueda
divergir del contrato.

### Fase 4 — Implementación con TDD

**Orden recomendado:** dominio puro primero (dinero con unidades menores, redondeo
determinista, suma de reparto == total, casos de uso con repositorios inyectados), después
schemas zod en los bordes, después API/UI cuando exista el Core.

**Reglas:**
- Un solo agente ejecuta el bucle rojo → verde → refactor; no se parte.
- Tests de aislamiento RLS por tabla (cuando exista la suite del Core).
- `i18n:check` en verde (cuando exista).
- Nada de `console.log`, `any` injustificado ni colores hardcodeados.
- UI solo con DS; si no hay componentes, **no implementes UI** y marca la capacidad bloqueada.

**Stop condition:** si falta la API del Core, no inventes endpoints `/api/v1` provisionales; si
falta el shell del admin, no inventes páginas. Entrega lo que sea verificable y reporta.

### Fase 5 — Revisión y auditoría

- Revisión de tarea (segundo agente) contra spec y plan.
- QA con ojos nuevos: bugs, casos límite, criterios de aceptación.
- Revisor de estilo: `code-style.md` (naming, estructura, código muerto, colores).
- **Auditoría de seguridad OWASP incondicional**, específica además de la general: RLS en
  todas las tablas, accesos cruzados, scopes mínimos, tools `write` no expuestas, secretos
  cifrados. Críticos/altos sin resolver bloquean `finalizada`.

### Fase 6 — Instalación y activación (cuando exista el Core)

- Validar el manifest contra el esquema; verificar `digest`/`down_digest`.
- Instalar: migraciones `up` en transacción, sembrar settings/i18n, registrar `installed`.
- Activar/desactivar sin tocar DDL; desinstalar revierte `down`, limpia settings/translations
  con `source: module:<key>` y borra el registry.
- **Confirmación explícita del super_admin** del diff del DDL antes de install/uninstall.
- **Stop condition:** sin instalador en runtime, no declares install/activate/uninstall; el
  módulo queda como paquete verificable, no como módulo instalable.

### Fase 7 — Aceptación y merge

- El usuario acepta la UI/el resultado en preview o APK (si aplica).
- Merge con orden explícita; squash; `main` desplegable.
- Cierre: verificar despliegue y pasar la tarea a `finalizada`.

## 5. Stop conditions por dependencia del Core

| Dependencia | Cómo detectarla | Qué hace el agente |
|---|---|---|
| Esquema zod + script de registry | no existe en `packages/` ni en scripts | escribe el manifest contra §3; validación mecánica **bloqueante** |
| Suite de tests RLS | no existe | escribe los tests de aislamiento; no los ejecuta contra una BD inexistente |
| Componentes del DS + Storybook | no existen | no implementa UI; entrega spec + dominio + API sin UI |
| Pipeline `i18n:scan`/`i18n:check` | no existe | escribe claves y locales; verificación **bloqueante** |
| Instalador en runtime | no existe | no declara install/activate/uninstall |
| API `/api/v1` del Core | no existe | no implementa endpoints dependientes; dominio puro + schemas |
| Shell del admin | no existe | no implementa `admin_pages` |

**Regla:** un módulo no se marca `finalizada` mientras una capacidad declarada en su manifest
no tenga su verificación real. Se marca `test` con la lista de bloqueos y se reporta.

## 6. Checklist de cierre

- [ ] Spec aprobada por el usuario y plan aprobado.
- [ ] `packages/<key>/manifest.json` cumple §3, sin placeholders y con digests calculados.
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

1. Empezar por el código sin spec aprobada.
2. Inventar registry, instalador o suite RLS "provisionales".
3. Poner `group_id` solo en algunas tablas.
4. Referenciar `profiles` en vez de `participants`.
5. Sembrar scopes en BD (viven en código).
6. Usar colores hex libres en `branding.color`.
7. Olvidar el `down` o los digests de las migraciones.
8. Declarar capacidades sin su documento asociado.
9. Exponer tools MCP `write` por defecto.
10. Marcar `finalizada` con capacidades bloqueadas por el Core.

## 8. Referencias

- Spec del sistema de módulos: `docs/superpowers/specs/2026-10-26-modulo-system.md` §3–§4, §10
- Spec de diseño: `docs/superpowers/specs/2026-10-24-027apps-design.md` §4, §9, §11
- Feature base: `docs/flows/feature.md` · Roles y puertas: `docs/flows/agents.md`
- i18n: `docs/flows/i18n.md` · CI/migraciones: `docs/flows/cicd.md`
- DoD: `docs/conventions/definition-of-done.md` · Seguridad: `docs/conventions/security-checklist.md`
- ADRs: `0004` (bordes), `0007` (errores), `0008` (fechas/moneda), `0009` (realtime)
- Skill y plantillas: `.opencode/skills/new-module/`
