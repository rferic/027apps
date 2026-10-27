# Responsabilidades de agentes

Quién hace qué, quién valida su salida y qué decide el usuario. Modelo de orquestación de la [spec §9](../superpowers/specs/2026-10-24-027apps-design.md): **plano** (orquestador + subagentes especializados, sin jerarquías profundas). Las obligaciones por tipo de tarea viven en [`AGENTS.md`](../../AGENTS.md); el cierre, en [`definition-of-done.md`](../conventions/definition-of-done.md); los pasos, en los flujos de este directorio.

## Mapa de roles

| Rol | Responsabilidad | Valida / revisa | Artefacto que produce | Quién valida su salida |
|---|---|---|---|---|
| **Orquestador** (sesión principal) | Hablar con el usuario, proponer tareas y sprints, **proponer** diseños (2–3 direcciones de identidad, mockups, tokens) que el usuario aprueba, redactar specs y planes, armar el contexto de cada subagente desde ficheros, despachar, revisar la tarea contra spec y plan, marcar `test` y `finalizada` en los ficheros de tarea, mergear con orden del usuario | Informes de los demás roles y su resultado contra spec y plan | Specs, planes, propuestas de diseño, packs de contexto, ficheros de tarea al día, informes de cierre | **El usuario** (aprueba specs, planes, diseños y resultados) |
| **Implementador** | Ejecutar **una** tarea con TDD (rojo → verde → refactor) en un solo bucle, marcar `en curso` al arrancar, autorevisarse y avisar de dudas | Su propio código (autorevisión) | Código, tests, docs y flujos actualizados, commits y PR | Checks mecánicos (lint, tsc, test, CI) y después revisor de tarea + QA + estilo + seguridad |
| **Revisor de tarea (segundo agente)** | Revisar la tarea contra spec y plan y la calidad del cambio con ojos nuevos; **nunca el autor** (fuente: [DoD](../conventions/definition-of-done.md)). En docs es el «segundo agente» del DoD de Docs | El diff del implementador | Informe de revisión: desviaciones de spec/plan y hallazgos de calidad, con severidad | Orquestador: cada hallazgo se corrige o se rechaza con motivo escrito |
| **QA (ojos nuevos)** | Revisar bugs, casos límite y criterios de aceptación de un cambio que **no** escribió. Con un diff pequeño, QA y revisión de estilo pueden fusionarse en un solo agente; la **auditoría de seguridad va siempre aparte** (fuente: DoD, puntos 5 y 6 de Código) | El diff del implementador | Lista de hallazgos con severidad y propuesta | Orquestador: cada hallazgo se corrige o se rechaza con motivo escrito |
| **Revisor de estilo** | Comprobar lo semántico de [`code-style.md`](../conventions/code-style.md) que ninguna herramienta rechaza (naming, estructura, claridad, código muerto, colores fuera de lo que detecta el lint) | El diff del implementador | Hallazgos de estilo; propuestas de regla de lint si un fallo se repite | Orquestador; el lint/CI sigue siendo el juez de lo mecánico |
| **Auditor de seguridad** | Auditoría OWASP incondicional (punto 6 del DoD) sobre toda implementación, antes de `finalizada`; nunca fusionado con QA ni estilo | El diff real | Informe por escrito: hallazgos, severidad, resolución | Orquestador comprueba que no quedan críticos/altos sin resolver; el usuario ve el resumen |
| **Traductor** | Rellenar los locales que falten (inglés como clave); puede paralelizarse por locale (único trabajo realmente independiente). **Solo abre PRs**, nunca escribe en BD ni cambia el inglés | Catálogo y locales del repo | `locales/*.json` del PR | El **`i18n:check`** del CI (claves y placeholders idénticos) y el orquestador para sentido y tono. Ver [`i18n.md`](i18n.md) |

Un mismo agente puede asumir varios roles solo si no viola las reglas de abajo (p. ej. QA y estilo en una misma pasada de un agente que no escribió el código); el auditor de seguridad no se fusiona con ellos.

## Puertas del usuario

Lo único que el usuario decide; el resto lo resuelven los agentes y las herramientas. **Nunca revisa código ni PRs.** Cada «**Puerta:**» de un flujo aparece aquí, referenciada como `fichero` + número de paso.

| Puerta | Qué decide | Dónde se aplica |
|---|---|---|
| **Specs y planes** | Aprueba la spec (y el plan) antes de implementar; responde las preguntas de producto | [`feature.md`](feature.md) 1, [`feature.md`](feature.md) 2, [`new-module.md`](new-module.md) 1 |
| **Cambio de spec en un bugfix** | Aprueba el cambio de spec cuando arreglar el bug cambia comportamiento especificado | [`bugfix.md`](bugfix.md) 1 |
| **Versión a publicar** | Aprueba publicar y el número de versión propuesto | [`release.md`](release.md) 1 |
| **Elección de tareas** | Al arrancar un sprint escoge qué se implementa de las candidatas propuestas | Spec §11 |
| **Identidad visual y diseño** | Elige entre las 2–3 direcciones que propone el orquestador y acepta mockups y tokens | DoD de Diseño |
| **Puertas de setup** | Acciones que solo él puede hacer: keystore y secrets de GitHub, conexión de Vercel y Supabase, rotación de credenciales | [`cicd.md`](cicd.md#pendiente-de-ejecución-puerta-de-usuario), [`release.md`](release.md#puerta-previa-una-sola-vez), [`hotfix.md`](hotfix.md) 1 |
| **Emergencia (hotfix)** | Se le informa de inmediato y confirma el camino de emergencia | [`hotfix.md`](hotfix.md) 1 |
| **Reescritura de historia** | Orden explícita si un secreto llegó al historial de git y limpiarlo exige reescribir historia compartida (`AGENTS.md`: nunca sin orden) | [`hotfix.md`](hotfix.md) 1 |
| **Aceptación** | Prueba el preview / la APK y acepta o rechaza el resultado (en un módulo, también la UI) | [`feature.md`](feature.md) 9, [`bugfix.md`](bugfix.md) 8, [`release.md`](release.md) 5, [`new-module.md`](new-module.md) 7 y 10 |
| **Merge a `main`** | Orden explícita de merge (`AGENTS.md`: no se mergea sin ella), también en revert y hotfix | [`feature.md`](feature.md) 10, [`bugfix.md`](bugfix.md) 9, [`hotfix.md`](hotfix.md) 2, [`release.md`](release.md) 2, [`new-module.md`](new-module.md) 10 |
| **Publicación (tag)** | Orden explícita de crear/empujar un tag (publica un binario instalable), también el de un hotfix de APK | [`release.md`](release.md) 3, [`hotfix.md`](hotfix.md) 5 |
| **Decisiones aplazadas** | Cuestiones abiertas de la spec (flujo de git, método de login, modelo de tokens…) cuando llegue su tarea de definición | Spec §11 |

## Reglas

1. **Contexto inyectado desde ficheros, nunca recordado.** Quien despacha arma el pack como texto desde ficheros: extracto de spec + convenciones + criterios de aceptación + rutas. Un subagente no asume lo que «ya se habló»; si le falta contexto, responde `NEEDS_CONTEXT` con lo que echa en falta (fuente: [`AGENTS.md`](../../AGENTS.md), «Contexto inyectado»).
2. **Determinismo antes que agentes.** Lint, typecheck, tests, CI y (cuando existan) el sync de claves i18n rechazan lo mecánico; los agentes solo deciden lo semántico. Si una regla de revisión falla de forma repetida, se propone convertirla en check ([`code-style.md`](../conventions/code-style.md#qué-se-hace-cumplir-y-cómo)).
3. **El implementador nunca despacha subagentes.** Todo el trabajo de su tarea lo hace él; la revisión llega después, del orquestador. Un subagente nunca despacha otros (fuente: [`AGENTS.md`](../../AGENTS.md)).
4. **El revisor nunca es el autor.** Quien escribió código o docs no aprueba su propia revisión ni su auditoría (fuente: [DoD](../conventions/definition-of-done.md)): revisión de tarea, QA, estilo y seguridad los hace otro agente con ojos nuevos. Si el orquestador escribe un cambio directamente, la revisión la hace otro agente.
5. **El bucle TDD no se parte.** Un solo agente lo ejecuta entero; partirlo pierde la intención.
6. **Paralelizar solo lo independiente** (p. ej. los locales de una traducción); sin estado compartido ni dependencias de orden.
7. **Los estados viven en los ficheros** (`pendiente` → `en curso` → `test` → `finalizada`), nunca en la memoria de nadie (fuente: [`AGENTS.md`](../../AGENTS.md)). El implementador marca `en curso`; el orquestador marca `test` (paso a revisión/QA/auditoría) y `finalizada` (solo al cumplir el [DoD](../conventions/definition-of-done.md)). Con rama de sprint, ver la nota provisional de [`feature.md`](feature.md#pasos).
8. **Sin evidencia no hay «pasa».** Todo informe de un agente cita los comandos ejecutados y su salida; los secretos nunca aparecen en ella (fuente: [`AGENTS.md`](../../AGENTS.md), «Secretos»).
9. **Estados de respuesta de un subagente:** `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED`. Son el contrato del proceso SDD (subagent-driven development) que usa el orquestador, no una segunda fuente de verdad: solo `NEEDS_CONTEXT` está además en `AGENTS.md`. Una contradicción entre documentos se reporta como preocupación, no se tapa.

## Criterio de cierre de este documento

Está al día cuando cada rol de un flujo aparece en el mapa, cada puerta de usuario de un flujo aparece en la tabla de puertas, y ninguna regla contradice `AGENTS.md` ni el DoD. Quien cambie un flujo revisa este fichero en el mismo PR.
