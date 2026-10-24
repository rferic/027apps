# Responsabilidades de agentes

Quién hace qué, quién valida su salida y qué decide el usuario. Modelo de orquestación de la [spec §9](../superpowers/specs/2026-10-24-027apps-design.md): **plano** (orquestador + subagentes especializados, sin jerarquías profundas). Las obligaciones por tipo de tarea viven en [`AGENTS.md`](../../AGENTS.md); el cierre, en [`definition-of-done.md`](../conventions/definition-of-done.md); los pasos, en los flujos de este directorio.

## Mapa de roles

| Rol | Responsabilidad | Artefacto que produce | Quién valida su salida |
|---|---|---|---|
| **Orquestador** (sesión principal) | Hablar con el usuario, proponer tareas y sprints, redactar specs y planes, armar el contexto de cada subagente desde ficheros, despachar, revisar la tarea contra spec y plan, mantener el `estado` de los ficheros de tarea, mergear con orden del usuario | Specs, planes, packs de contexto, ficheros de tarea al día, informes de cierre | **El usuario** (aprueba specs, planes y resultados) |
| **Implementador** | Ejecutar **una** tarea con TDD (rojo → verde → refactor) en un solo bucle, autorevisarse y avisar de dudas | Código, tests, docs y flujos actualizados, commits y PR | Checks mecánicos (lint, tsc, test, CI) y después orquestador + QA + estilo + seguridad |
| **QA (ojos nuevos)** | Revisar bugs, casos límite y criterios de aceptación de un cambio que **no** escribió | Lista de hallazgos con severidad y propuesta | Orquestador: cada hallazgo se corrige o se rechaza con motivo escrito |
| **Revisor de estilo** | Comprobar lo semántico de [`code-style.md`](../conventions/code-style.md) que ninguna herramienta rechaza (naming, estructura, claridad, código muerto, colores fuera de lo que detecta el lint) | Hallazgos de estilo; propuestas de regla de lint si un fallo se repite | Orquestador; el lint/CI sigue siendo el juez de lo mecánico |
| **Auditor de seguridad** | Auditoría OWASP incondicional (punto 6 del DoD) sobre toda implementación, antes de `finalizada` | Informe por escrito: hallazgos, severidad, resolución | Orquestador comprueba que no quedan críticos/altos sin resolver; el usuario ve el resumen |
| **Traductor** | Generar traducciones iniciales a es, ca, en, it a partir de las claves; puede paralelizarse por locale (único trabajo realmente independiente) | Valores de los locales | El **check de CI** de claves iguales (**TODO:** aún no existe, ver [`new-module.md`](new-module.md)) y el orquestador para sentido y tono |

Un mismo agente puede asumir varios roles solo si no viola las reglas de abajo (p. ej. QA y estilo en una misma pasada de un agente que no escribió el código).

## Puertas del usuario

Lo único que el usuario decide; el resto lo resuelven los agentes y las herramientas. **Nunca revisa código ni PRs.**

| Puerta | Qué decide | Dónde se aplica |
|---|---|---|
| **Specs y planes** | Aprueba la spec (y el plan) antes de implementar; responde las preguntas de producto | [`feature.md`](feature.md) 1–2, [`new-module.md`](new-module.md) 1 |
| **Elección de tareas** | Al arrancar un sprint escoge qué se implementa de las candidatas propuestas | Spec §11 |
| **Identidad visual y diseño** | Elige entre las 2–3 direcciones propuestas y acepta mockups y tokens | DoD de Diseño |
| **Puertas de setup** | Acciones que solo él puede hacer: keystore y secrets de GitHub, conexión de Vercel y Supabase, rotación de credenciales | [`cicd.md`](cicd.md#pendiente-de-ejecución-puerta-de-usuario), [`hotfix.md`](hotfix.md) 1 |
| **Aceptación** | Prueba el preview / la APK y acepta o rechaza el resultado | [`feature.md`](feature.md) 9, [`bugfix.md`](bugfix.md) 8, [`release.md`](release.md) 5 |
| **Merge y publicación** | Orden explícita de merge a `main` y de publicar un tag/release (`AGENTS.md`: no se mergea sin ella) | [`feature.md`](feature.md) 10, [`release.md`](release.md) 1–3 |
| **Decisiones aplazadas** | Cuestiones abiertas de la spec (flujo de git, método de login, modelo de tokens…) cuando llegue su tarea de definición | Spec §11 |

## Reglas

1. **Contexto inyectado desde ficheros, nunca recordado.** Quien despacha arma el pack como texto desde ficheros: extracto de spec + convenciones + criterios de aceptación + rutas. Un subagente no asume lo que «ya se habló»; si le falta contexto, responde `NEEDS_CONTEXT` con lo que echa en falta.
2. **Determinismo antes que agentes.** Lint, typecheck, tests, CI y (cuando existan) el sync de claves i18n rechazan lo mecánico; los agentes solo deciden lo semántico. Si una regla de revisión falla de forma repetida, se propone convertirla en check ([`code-style.md`](../conventions/code-style.md#qué-se-hace-cumplir-y-cómo)).
3. **El implementador nunca despacha subagentes.** Todo el trabajo de su tarea lo hace él; la revisión llega después, del orquestador. Un subagente nunca despacha otros (`AGENTS.md`).
4. **El revisor nunca es el autor.** Quien escribió código o docs no aprueba su propia revisión ni su auditoría (DoD): QA, estilo y seguridad los hace otro agente con ojos nuevos. Si el orquestador escribe un cambio directamente, la revisión la hace otro agente.
5. **El bucle TDD no se parte.** Un solo agente lo ejecuta entero; partirlo pierde la intención.
6. **Paralelizar solo lo independiente** (p. ej. los 4 locales de una traducción); sin estado compartido ni dependencias de orden.
7. **Los estados viven en los ficheros** (`pendiente` → `en curso` → `test` → `finalizada`), nunca en la memoria de nadie. El orquestador los actualiza; `test` marca el paso a revisión/QA/auditoría.
8. **Sin evidencia no hay «pasa».** Todo informe de un agente cita los comandos ejecutados y su salida; los secretos nunca aparecen en ella.
9. **Estados de respuesta de un subagente:** `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED`. Una contradicción entre documentos se reporta como preocupación, no se tapa.

## Criterio de cierre de este documento

Está al día cuando cada rol de un flujo aparece en el mapa, cada puerta de usuario de un flujo aparece en la tabla de puertas, y ninguna regla contradice `AGENTS.md` ni el DoD. Quien cambie un flujo revisa este fichero en el mismo PR.
