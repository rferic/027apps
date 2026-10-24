# Flujo: bugfix

Corregir un defecto no urgente. Si hay producción rota ahora mismo, usa [`hotfix.md`](hotfix.md). Obligaciones en [`AGENTS.md`](../../AGENTS.md); cierre en [`definition-of-done.md`](../conventions/definition-of-done.md); roles en [`agents.md`](agents.md).

## Pasos

| # | Paso | Ejecuta | Revisa / verifica | Decide el usuario |
|---|---|---|---|---|
| 1 | **Reproducir y diagnosticar**: reproducción fiable y **causa raíz** identificada (no solo el síntoma). Se documenta en el PR | Implementador (skill `systematic-debugging`) | Orquestador: la causa explica el síntoma | Si el arreglo implica cambiar comportamiento especificado: **puerta, aprueba el cambio de spec** |
| 2 | **Arranque**: rama `fix/*` y fichero de tarea a `estado: en curso` | Orquestador | — | — |
| 3 | **Test de regresión** que **falla** antes del fix; se ejecuta y se lee la salida roja | Implementador | La salida demuestra que falla por la causa raíz | — |
| 4 | **Fix mínimo** hasta verde; refactor sin ampliar alcance | Implementador | Checklist de `AGENTS.md` (lint, tsc, test, build si aplica) con salida leída | — |
| 5 | **Autorevisión** y PR: título `fix(...)`, fichero de tarea a `estado: test` | Implementador | CI: `admin`, `android`, `guard-secrets`, `commitlint` | — |
| 6 | **Revisión de la tarea y QA con ojos nuevos**: ¿el test cubre la causa raíz y no solo el caso reportado? ¿hay regresiones vecinas? | Orquestador + agente QA (distinto del autor) | Criterios de aceptación del bug | — |
| 7 | **Auditoría de seguridad OWASP, incondicional**, también en fixes pequeños | Auditor de seguridad | Orquestador comprueba hallazgos resueltos | Ve el resumen del informe |
| 8 | **Aceptación** cuando el bug era visible para el usuario | Orquestador presenta el resultado | — | **Puerta: confirma que el síntoma desapareció** (preview/APK) |
| 9 | **Merge** squash a `main` y cierre: `estado: finalizada` | Orquestador | Checks requeridos en verde | **Puerta: orden explícita de merge** |

## Criterio de cierre

`finalizada` cuando el test de regresión falla sin el fix y pasa con él, la causa raíz está documentada, la auditoría de seguridad está hecha y el DoD de Código se cumple, con el fix mergeado en `main`.
