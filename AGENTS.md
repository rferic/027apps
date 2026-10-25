# AGENTS.md — contrato para sesiones de agentes

Este fichero se carga en cada sesión. Es obligatorio, no orientativo. Si algo aquí choca con tu criterio, gana este fichero; si crees que está mal, díselo al usuario en vez de saltártelo.

## Misión

027Apps: plataforma familiar modular y autoalojable. Panel web (`apps/admin`, Next.js + Supabase) y app Android (`apps/android`, Kotlin). El README de raíz se escribe en inglés; documentación interna y specs en español; **código, ramas, commits y toda la superficie de GitHub en inglés**: títulos y descripciones (body) de PRs, descripciones de repositorio, releases y changelog. El producto se localiza según sus idiomas soportados.
Todo cambio sigue spec → plan → implementación con TDD → revisión → auditoría de seguridad. Nada se implementa sin spec aprobada.

## Mapa de docs (leer en este orden)

1. `docs/tasks/sprint-*/task-NN.md` — tu tarea: estado y enlace al plan. Actualiza `estado` (`pendiente` → `en curso` → `test` → `finalizada`): `en curso` al empezar, `test` cuando la implementación está lista y pasa a revisión/QA/auditoría, `finalizada` solo al cumplir la definición de terminado.
2. `docs/superpowers/plans/` — el plan de la tarea (pasos exactos).
3. `docs/superpowers/specs/2026-10-24-027apps-design.md` — spec de diseño (arquitectura, stack, modelo de datos).
4. `docs/conventions/code-style.md` — estilo y qué hace cumplir cada herramienta.
5. `docs/conventions/definition-of-done.md` — cuándo una tarea puede ser `finalizada`.
6. `docs/flows/` — flujos (CI/CD: `docs/flows/cicd.md`). Si cambias CI, deploy o releases, actualiza el flujo en el mismo PR.
7. `apps/admin/AGENTS.md` — aviso de Next.js: esta versión difiere de lo que sabes; lee `node_modules/next/dist/docs/` antes de escribir código de Next.

## Reglas transversales

- **Determinismo antes que agentes**: lint, typecheck, tests y CI deciden lo mecánico. No gastes juicio en lo que una herramienta puede rechazar; si ves una convención mecánica sin check, propón el check.
- **Contexto inyectado, nunca recordado** (subagentes): quien despacha pasa el contexto como texto armado desde ficheros (extracto de spec + convenciones + criterios de aceptación + rutas). Un subagente no asume lo que "ya se habló" ni lo que recuerda de otra sesión; si le falta contexto, reporta `NEEDS_CONTEXT`. Un subagente no despacha otros subagentes.
- **Secretos**: nunca en git, logs, ni en la salida de comandos (`.env*`, keystores, tokens). Ver `docs/flows/cicd.md`.
- **API-first**: móvil y terceros solo hablan con `/api/v1`; nunca con la BD.
- Cambios mínimos y del alcance de la tarea. No toques ficheros ajenos a ella.

## Obligaciones por tipo de tarea

| Tipo | Obligatorio |
|---|---|
| **feature** | Spec/plan aprobados. Test primero (TDD: rojo → verde → refactor). Validación con zod en los bordes de API. Colores solo vía tokens semánticos. Docs/flujo actualizados si cambia el comportamiento. Auditoría de seguridad antes de `finalizada`. |
| **bugfix** | Test de regresión que falla antes del fix y pasa después. Causa raíz identificada, no solo el síntoma. Auditoría de seguridad siempre antes de `finalizada` (incondicional, como en feature y refactor). |
| **refactor** | Tests existentes en verde sin modificarlos para que pasen; test nuevo si cambia el comportamiento observable. Auditoría de seguridad siempre antes de `finalizada`. |
| **docs** | Sin contradecir spec ni flujos existentes. Revisión de un segundo agente. Rutas y comandos citados verificados contra el repo. |
| **infra** (CI, deploy, config, dependencias) | Actualizar `docs/flows/`. Permisos mínimos, acciones de terceros fijadas por SHA de commit (las `actions/*` de GitHub pueden ir en tag mayor), secretos solo por `env` en el paso que los usa. Evidencia real de que el check pasa/falla como se espera. Auditoría de seguridad antes de `finalizada`. |

La auditoría de seguridad es **incondicional**: toda implementación (código, infra) la requiere antes de `finalizada`, sin excepción por tamaño o ámbito.

Definición completa de "terminado" por tipo: `docs/conventions/definition-of-done.md`.

## Checklist obligatoria antes de cada commit

- [ ] Estoy en una rama de trabajo (`feature/*`, `fix/*`, `chore/*`, `docs/*`, `sprint/*`), no en `main`.
- [ ] `pnpm lint && pnpm tsc && pnpm test` en verde (desde la raíz). Si toqué el admin: `pnpm --filter admin build`. Si toqué Android: `cd apps/android && ./gradlew :app:testDebugUnitTest`.
- [ ] Ejecuté los comandos y leí su salida; no afirmo "pasa" sin evidencia.
- [ ] Sin colores hardcodeados, sin `any` injustificado, sin `console.log` olvidados, sin código comentado.
- [ ] Sin secretos ni ficheros `.env*`/keystores en `git status`.
- [ ] Docs, flujos y fichero de tarea actualizados si procede.
- [ ] Mensaje de commit y título de PR en Conventional Commits: `tipo(ámbito opcional): asunto en minúsculas` con tipo en `feat|fix|docs|chore|ci|refactor|test|perf|build`. El job `commitlint` rechaza el PR si no.

## Git

- **Idioma de la superficie de GitHub en inglés**: ramas (`sprint/NN-<slug>`, `feature/*`, `fix/*`, `docs/*`, `chore/*`), mensajes de commit (Conventional Commits), títulos y **body de PRs**, descripciones de repositorio, releases y changelog. El contenido técnico de `docs/` (specs, ADRs, flujos, convenciones) se escribe en español; solo lo que GitHub muestra públicamente (y el código) va en inglés.
- Un PR por cambio; squash merge a `main` (el título del PR es el commit). `main` siempre desplegable.
- No mergees, no fuerces push ni reescribas historia compartida sin orden explícita del usuario.
- La tarea no es `finalizada` hasta cumplir `docs/conventions/definition-of-done.md`, incluida la auditoría de seguridad.
