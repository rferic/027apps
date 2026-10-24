# Flujo: feature

Cómo entra una funcionalidad nueva (spec-driven development, ver spec §9). Las obligaciones están en [`AGENTS.md`](../../AGENTS.md) y el criterio de cierre en [`definition-of-done.md`](../conventions/definition-of-done.md); este flujo ordena los pasos y no los repite. Roles en [`agents.md`](agents.md).

**Regla del usuario:** el usuario revisa y decide sobre specs, diseños y resultados (preview, demo, APK); **nunca revisa código ni PRs**.

## Pasos

| # | Paso | Ejecuta | Revisa / verifica | Decide el usuario |
|---|---|---|---|---|
| 1 | **Spec**: brainstorming y spec en `docs/superpowers/specs/`. Las tareas grandes llevan spec propia antes de `en curso`; los lotes pequeños pueden compartir el plan del sprint | Orquestador | Auto-revisión de la spec; coherencia con la spec de diseño | **Puerta: aprueba la spec.** Nada se implementa sin spec aprobada |
| 2 | **Plan** en `docs/superpowers/plans/` (pasos exactos, ficheros, comandos, criterios de aceptación) | Orquestador | Cubre todos los requisitos de la spec | **Puerta: aprueba el plan** |
| 3 | **Arranque**: rama `feature/*` (no `main`; ver [git](release.md#flujo-de-git-pendiente-de-decisión)) y fichero de tarea a `estado: en curso` | Orquestador | — | — |
| 4 | **Implementación con TDD**: test primero (rojo → verde → refactor), un solo agente para todo el bucle. Recibe el contexto inyectado (spec + convenciones + criterios + rutas) | Implementador | Verificación mecánica local: la checklist de `AGENTS.md` (lint, tsc, test, build si aplica) con la salida leída | — |
| 5 | **Autorevisión** del implementador contra spec, plan y [`code-style.md`](../conventions/code-style.md); informa de dudas y desviaciones (no las oculta) | Implementador | — | — |
| 6 | **PR**: título en Conventional Commits; fichero de tarea a `estado: test`; docs y flujos actualizados si cambia el comportamiento | Implementador / Orquestador | CI: `admin`, `android`, `guard-secrets`, `commitlint` en verde; Vercel crea el preview ([cicd.md](cicd.md)) | — |
| 7 | **Revisión de la tarea** (spec + calidad) y **QA con ojos nuevos**: bugs, casos límite, estilo contra `code-style.md`. Los hallazgos se corrigen o se rechazan con motivo escrito | Orquestador + agentes QA y de estilo (distintos del autor) | Criterios de aceptación de spec/plan | — |
| 8 | **Auditoría de seguridad OWASP, incondicional** (punto 6 del DoD) por un agente distinto del autor; informe por escrito. Críticos/altos sin resolver bloquean | Auditor de seguridad | Orquestador comprueba que cada hallazgo está resuelto o rechazado con motivo | Ve el resumen del informe; no lo revisa línea a línea |
| 9 | **Aceptación** cuando aplica (UI, flujo visible, APK): el usuario prueba el preview o la APK de `apk-debug` | Orquestador presenta el resultado | — | **Puerta: acepta el resultado** (en el PR o en la sesión). Sin aceptación no se mergea |
| 10 | **Merge**: squash merge a `main` (el título del PR es el commit). Vercel despliega producción | Orquestador | Checks requeridos en verde | **Puerta: orden explícita de merge** (`AGENTS.md`: no se mergea sin ella) |
| 11 | **Cierre**: fichero de tarea a `estado: finalizada` | Orquestador | DoD completa | — |

Pasos 7 y 8 se repiten tras cada corrección hasta que no queden hallazgos abiertos. Una corrección que cambie la spec vuelve a la puerta del paso 1.

## Variantes por tipo de cambio

- **Docs:** pasos 5–11 con el DoD de Docs (revisión de un segundo agente, rutas y comandos verificados contra el repo). Si documenta credenciales, tokens o configuración sensible, también la auditoría de seguridad (paso 8).
- **Infra (CI, deploy, dependencias):** además actualiza [`cicd.md`](cicd.md) en el mismo PR y aporta evidencia real de que el check falla/pasa como debe.
- **Diseño (identidad, tokens, mockups):** el usuario elige entre las propuestas y acepta el mockup (puerta en el paso 1/9); tokens en claro y oscuro con contraste verificado.
- **Módulo nuevo:** además sigue [`new-module.md`](new-module.md).

## Criterio de cierre

La tarea es `finalizada` cuando se cumplen todos los puntos de su tipo en el [DoD](../conventions/definition-of-done.md), incluidas la auditoría de seguridad y la aceptación del usuario cuando aplica, y el cambio está mergeado en `main`.
