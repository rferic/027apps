# Flujo: hotfix

Producción (admin en Vercel o APK publicada) está rota o expuesta ahora. Prioridad: **restablecer el servicio primero, corregir la causa después**. No relaja ninguna obligación de [`AGENTS.md`](../../AGENTS.md): solo cambia el orden y la urgencia. Roles en [`agents.md`](agents.md).

## Pasos

| # | Paso | Ejecuta | Revisa / verifica | Decide el usuario |
|---|---|---|---|---|
| 1 | **Avisar y clasificar**: qué falla, desde qué commit/versión, a quién afecta. Si hay un secreto expuesto, rotarlo es lo primero (nunca se pega su valor en logs ni PRs) | Orquestador | — | **Puerta: se le informa de inmediato** y confirma el camino de emergencia. La rotación de credenciales la hace el usuario. **Puerta: si el secreto llegó al historial de git**, limpiarlo exige reescribir historia compartida: solo con orden explícita del usuario (`AGENTS.md`) |
| 2 | **Mitigar**: lo más rápido y seguro es volver al estado anterior bueno con `git revert` en `main` (o, solo en emergencia, promover el deployment anterior en Vercel y reconciliar después con el revert). Detalle y alcance en [Rollback de `cicd.md`](cicd.md#rollback) | Orquestador / Implementador | Rama `fix/*`; PR con título Conventional Commits; mismos gates de CI (no hay atajo que se los salte) | **Puerta: orden explícita de merge** |
| 3 | **Verificar la recuperación**: `/api/health` responde `ok` y el síntoma desaparece en producción | Orquestador | Check de Vercel y keep-alive ([cicd.md](cicd.md)) | — |
| 4 | **Causa raíz y arreglo definitivo**: se sigue [`bugfix.md`](bugfix.md) desde el paso 1 (test de regresión que falla, fix mínimo, QA, auditoría) | Implementador | Como en `bugfix.md` | Como en `bugfix.md` |
| 5 | **Casos especiales**: *migración* mala → no se revierte con `git revert`, se corrige hacia delante con una migración nueva. *APK* mala → nuevo tag con `versionCode` mayor ([release.md](release.md)); la defectuosa se marca pre-release/borrador | Orquestador / Implementador | Ver [Rollback](cicd.md#rollback) | **Puerta: orden explícita de tag** (publica un binario instalable) |
| 6 | **Postmortem breve** en el PR del fix definitivo: causa, impacto, verificación de que el revert fue el inverso exacto (si aplica), qué check/test habría evitado el fallo. Si procede, se propone el check (determinismo antes que agentes) | Orquestador | — | — |

## Política de revert y auditoría

La auditoría de seguridad **no se omite** por urgencia, pero el momento depende de qué se mergea (fuente de las obligaciones: [`AGENTS.md`](../../AGENTS.md) y [DoD](../conventions/definition-of-done.md)):

- **Revert puro de un commit ya auditado:** se mergea con CI verde y orden del usuario, **sin auditoría previa**. Después se verifica de forma mecánica que su diff es exactamente el inverso del commit revertido (p. ej. `git diff C^ C | git patch-id --stable` coincide con `git diff R R^ | git patch-id --stable`, con `C` el commit revertido y `R` el revert) y el resultado queda por escrito en el postmortem o en el PR del fix definitivo.
- **Exigen auditoría previa al merge:** los reverts parciales o con resolución manual de conflictos, y los reverts de commits que eran fixes de seguridad (revertirlos reabre la vulnerabilidad).
- **El arreglo definitivo** conserva la auditoría OWASP completa ([`bugfix.md`](bugfix.md) paso 7) y es lo que se marca `finalizada`.

## Criterio de cierre

El incidente se cierra cuando producción está sana (paso 3) **y** el arreglo definitivo es `finalizada` según [`bugfix.md`](bugfix.md) y el [DoD](../conventions/definition-of-done.md) (con rama de sprint, ver la nota provisional de [`feature.md`](feature.md#pasos)). Un revert que restablece el servicio sin arreglo definitivo deja la tarea del fix en `en curso`.
