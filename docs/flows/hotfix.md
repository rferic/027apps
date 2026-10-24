# Flujo: hotfix

Producción (admin en Vercel o APK publicada) está rota o expuesta ahora. Prioridad: **restablecer el servicio primero, corregir la causa después**. No relaja ninguna obligación de [`AGENTS.md`](../../AGENTS.md): solo cambia el orden y la urgencia. Roles en [`agents.md`](agents.md).

## Pasos

| # | Paso | Ejecuta | Revisa / verifica | Decide el usuario |
|---|---|---|---|---|
| 1 | **Avisar y clasificar**: qué falla, desde qué commit/versión, a quién afecta. Si hay un secreto expuesto, rotarlo es lo primero (nunca se pega su valor en logs ni PRs) | Orquestador | — | **Puerta: se le informa de inmediato** y confirma el camino de emergencia. La rotación de credenciales la hace el usuario |
| 2 | **Mitigar**: lo más rápido y seguro es volver al estado anterior bueno con `git revert` en `main` (o, solo en emergencia, promover el deployment anterior en Vercel y reconciliar después con el revert). Detalle y alcance en [Rollback de `cicd.md`](cicd.md#rollback) | Orquestador / Implementador | Rama `fix/*`; PR con título Conventional Commits; mismos gates de CI (no hay atajo que se los salte) | **Puerta: orden explícita de merge** |
| 3 | **Verificar la recuperación**: `/api/health` responde `ok` y el síntoma desaparece en producción | Orquestador | Check de Vercel y keep-alive ([cicd.md](cicd.md)) | — |
| 4 | **Causa raíz y arreglo definitivo**: se sigue [`bugfix.md`](bugfix.md) desde el paso 1 (test de regresión que falla, fix mínimo, QA, auditoría) | Implementador | Como en `bugfix.md` | Como en `bugfix.md` |
| 5 | **Casos especiales**: *migración* mala → no se revierte con `git revert`, se corrige hacia delante con una migración nueva. *APK* mala → nuevo tag con `versionCode` mayor ([release.md](release.md)); la defectuosa se marca pre-release/borrador | Orquestador / Implementador | Ver [Rollback](cicd.md#rollback) | Aprueba publicar el nuevo tag |
| 6 | **Postmortem breve** en el PR del fix definitivo: causa, impacto, qué check/test habría evitado el fallo. Si procede, se propone el check (determinismo antes que agentes) | Orquestador | — | — |

La auditoría de seguridad **no se omite** por urgencia: se hace sobre el diff real antes de `finalizada`. En un revert puro consiste en confirmar que restituye un estado ya auditado.

## Criterio de cierre

El incidente se cierra cuando producción está sana (paso 3) **y** el arreglo definitivo es `finalizada` según [`bugfix.md`](bugfix.md) y el [DoD](../conventions/definition-of-done.md). Un revert que restablece el servicio sin arreglo definitivo deja la tarea del fix en `en curso`.
