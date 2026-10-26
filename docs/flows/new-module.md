# Flujo: nuevo módulo (esqueleto)

> **Estado: esqueleto.** Se completa cuando exista el Core (instalador de módulos en runtime, modelo de tokens, API v1, i18n operativa, realtime). Cada `TODO` marca algo que aún no existe; no se inventa su forma aquí. Concepto de módulo: [spec §4 «Sistema de módulos»](../superpowers/specs/2026-10-24-027apps-design.md): paquete del monorepo (`packages/*`), instalación global por instancia y activación por grupo.

Un módulo es una tarea de tipo **feature** (con DDL): sigue [`feature.md`](feature.md) completo y añade lo de abajo. Roles en [`agents.md`](agents.md).

## Pasos

| # | Paso | Ejecuta | Revisa / verifica | Decide el usuario |
|---|---|---|---|---|
| 1 | **Spec del módulo** (tablas, pantallas, límites de v1, permisos, tools MCP, eventos). Dependencias de Core registradas en la tarea | Orquestador | Coherencia con la spec de diseño y con las tareas de Core `finalizada` | **Puerta: aprueba la spec** (y los mockups de las pantallas clave: **puerta de diseño**) |
| 2 | **Manifest** `manifest.json` del módulo. **TODO:** el contrato (formato, ubicación, script de registry) lo fija una tarea de fundaciones/Core; enlazarlo aquí cuando exista | Implementador | **TODO:** validación mecánica del manifest contra su esquema (script de registry) | — |
| 3 | **DDL con rollback**: migración del módulo + su rollback. Todas las tablas llevan `group_id` y RLS scoped al grupo; los módulos referencian `participants`, nunca `profiles`. Compatibilidad hacia atrás: [Migraciones en `cicd.md`](cicd.md#migraciones-supabase) | Implementador | Tests de aislamiento entre grupos (**TODO:** suite RLS del Core) | — |
| 4 | **Claves i18n** en los 4 locales (es, ca, en, it); ningún string visible fuera de i18n | Implementador + Traductor | **TODO:** script de sync y check de CI que falla si los locales no tienen las mismas claves (aún no existen) | — |
| 5 | **Tools MCP** y scopes del módulo | Implementador | **TODO:** contrato MCP y scopes por módulo (spec de API/tokens del Core) | — |
| 6 | **Eventos realtime** del módulo | Implementador | Contrato de canales y eventos en [`2026-10-26-realtime-notificaciones.md`](../superpowers/specs/2026-10-26-realtime-notificaciones.md) (ADR 0009): el módulo declara `channels` (`pattern` + `members_fn`) y `eventos` (`type`, `target`, `subject`, `notify`) en su manifest | — |
| 7 | **UI solo con el design system**: componentes del DS y tokens semánticos; nada de estilos ad-hoc ni colores hardcodeados ([`code-style.md`](../conventions/code-style.md#colores)). **TODO:** componentes base del DS y Storybook | Implementador | Lint de colores (mecánico) + revisor de estilo | **Puerta: acepta la UI** en el preview/APK |
| 8 | **Registro**: alta en el instalador. **TODO:** instalador del Core; skill `new-module` (`.opencode/skills/`) que automatice los pasos 2–6 | Implementador | **TODO** | — |
| 9 | **Revisión de seguridad específica** además de la auditoría OWASP incondicional: RLS en todas las tablas, accesos cruzados entre grupos, scopes mínimos de las tools MCP, nada de dinero/tokens expuestos de más | Auditor de seguridad | Informe por escrito; críticos/altos bloquean | Ve el resumen del informe |
| 10 | **Aceptación y merge** como en [`feature.md`](feature.md) (pasos 9–11) | Orquestador | DoD de Código | **Puertas: aceptación del resultado y orden de merge** |

## Criterio de cierre

Cuando el esqueleto se complete: módulo `finalizada` según [DoD](../conventions/definition-of-done.md), con manifest válido, instalable y reversible (DDL + rollback), 4 locales en sincronía, UI solo con DS y auditoría de seguridad hecha. Mientras existan `TODO`, este flujo **no** puede darse por cerrado para ningún módulo real: el primero que lo use debe completarlo en el mismo PR.
