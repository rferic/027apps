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
6. `docs/flows/` — flujos (CI/CD: `docs/flows/cicd.md`; verificación antes de entregar: `docs/flows/pre-delivery-verification.md`). Si cambias CI, deploy o releases, actualiza el flujo en el mismo PR.
7. `docs/infrastructure.md` — inventario de servicios, límites del free tier, backups y recuperación (runbook operativo).
8. `apps/admin/AGENTS.md` — aviso de Next.js: esta versión difiere de lo que sabes; lee `node_modules/next/dist/docs/` antes de escribir código de Next.
9. `docs/ai/landing.md` — contenido y estado de los módulos de la landing; cuándo actualizarla.

Para crear o cambiar un módulo: `docs/ai/module-system.md` (contrato canónico),
`.opencode/skills/new-module/SKILL.md` (skill) y su ficha en `docs/ai/landing.md`. No dupliques
el contrato del manifest. **Implementar un módulo incluye actualizar la web pública** (`/` y
`/self-host`, catálogo y captura real si pasa a `available`) en el mismo PR; sin eso la tarea
no está `finalizada`.

## Reglas transversales

- **Determinismo antes que agentes**: lint, typecheck, tests y CI deciden lo mecánico. No gastes juicio en lo que una herramienta puede rechazar; si ves una convención mecánica sin check, propón el check.
- **Navegación de código**: con el MCP `codegraph` disponible, las preguntas estructurales
  («dónde está definido X», «quién llama a Y», «qué rompe si cambio Z») se responden con
  `codegraph_search` / `codegraph_callers` / `codegraph_impact` antes que con grep. El índice vive
  en `.codegraph/` (ignorado por git, caché local): se crea con `codegraph init .` en la raíz del
  checkout. En un worktree el índice es propio (`codegraph init .` allí) y hay que pasar
  `projectPath` de ese worktree; el del checkout principal está en otra rama. Sin el MCP el flujo
  es grep y lectura; nada del build ni del CI depende de él.
- **Contexto inyectado, nunca recordado** (subagentes): quien despacha pasa el contexto como texto armado desde ficheros (extracto de spec + convenciones + criterios de aceptación + rutas). Un subagente no asume lo que "ya se habló" ni lo que recuerda de otra sesión; si le falta contexto, reporta `NEEDS_CONTEXT`. Un subagente no despacha otros subagentes.
- **Secretos**: nunca en git, logs, ni en la salida de comandos (`.env*`, keystores, tokens). Ver `docs/flows/cicd.md`.
- **API-first**: móvil y terceros solo hablan con `/api/v1`; nunca con la BD.
- **Verificar antes de entregar**: nada se anuncia al propietario (PR, mensaje, APK, «ya puedes
  probarlo») sin haberlo ejecutado antes contra el entorno real y con la salida leída. La rutina
  y la checklist están en `docs/flows/pre-delivery-verification.md`; la parte automática es
  `scripts/verify-local.sh`. Un fallo encontrado se convierte en test de regresión o check, no en
  una nota mental.
- Cambios mínimos y del alcance de la tarea. No toques ficheros ajenos a ella.

## Module contract changes

Cualquier cambio en el contrato del manifest, el ciclo de vida o el flujo de creación de
módulos debe actualizar, en el mismo PR:

- `docs/ai/module-system.md`
- `docs/ai/manifest.schema.json` (si cambia el esquema)
- la sección de módulos de este fichero y el puntero de `CLAUDE.md`
- los envoltorios de proveedor (`.opencode/`, `.claude/`, `.agents/`)
- los ejemplos si cambia la forma

Un cambio solo de código que deje esta documentación desactualizada está incompleto.

## Obligaciones por tipo de tarea

| Tipo | Obligatorio |
|---|---|
| **feature** | Spec/plan aprobados. Test primero (TDD: rojo → verde → refactor). Validación con zod en los bordes de API. Colores solo vía tokens semánticos. Docs/flujo actualizados si cambia el comportamiento. Auditoría de seguridad antes de `finalizada`. |
| **bugfix** | Test de regresión que falla antes del fix y pasa después. Causa raíz identificada, no solo el síntoma. Auditoría de seguridad siempre antes de `finalizada` (incondicional, como en feature y refactor). |
| **refactor** | Tests existentes en verde sin modificarlos para que pasen; test nuevo si cambia el comportamiento observable. Auditoría de seguridad siempre antes de `finalizada`. |
| **docs** | Sin contradecir spec ni flujos existentes. Revisión de un segundo agente. Rutas y comandos citados verificados contra el repo. |
| **infra** (CI, deploy, config, dependencias) | Actualizar `docs/flows/`. Permisos mínimos, acciones de terceros fijadas por SHA de commit (las `actions/*` de GitHub pueden ir en tag mayor), secretos solo por `env` en el paso que los usa. Evidencia real de que el check pasa/falla como se espera. Auditoría de seguridad antes de `finalizada`. |
| **module-contract** (manifest, ciclo de vida, flujo de creación) | Actualizar en el mismo PR: `docs/ai/module-system.md`, `docs/ai/manifest.schema.json` si cambia el esquema, la sección de módulos de este fichero y el puntero de `CLAUDE.md`, los envoltorios de proveedor y los ejemplos si cambia la forma. Un cambio solo de código que deje la documentación de IA desactualizada está incompleto. |

La auditoría de seguridad es **incondicional**: toda implementación (código, infra) la requiere antes de `finalizada`, sin excepción por tamaño o ámbito.

Definición completa de "terminado" por tipo: `docs/conventions/definition-of-done.md`.

## Checklist obligatoria antes de cada commit

- [ ] Estoy en una rama de trabajo (`feature/*`, `fix/*`, `chore/*`, `docs/*`, `sprint/*`), no en `main` ni en `staging`.
- [ ] `pnpm lint && pnpm tsc && pnpm test` en verde (desde la raíz). Si toqué el admin: `pnpm --filter admin build`. Si toqué Android: `cd apps/android && ./gradlew :app:testDebugUnitTest`.
- [ ] Ejecuté los comandos y leí su salida; no afirmo "pasa" sin evidencia.
- [ ] Sin colores hardcodeados, sin `any` injustificado, sin `console.log` olvidados, sin código comentado.
- [ ] Sin secretos ni ficheros `.env*`/keystores en `git status`.
- [ ] Docs, flujos y fichero de tarea actualizados si procede.
- [ ] Si cambié el contrato del módulo, actualicé `docs/ai/module-system.md`, el esquema y los envoltorios.
- [ ] Mensaje de commit y título de PR en Conventional Commits: `tipo(ámbito opcional): asunto en minúsculas` con tipo en `feat|fix|docs|chore|ci|refactor|test|perf|build`. El job `commitlint` rechaza el PR si no.

## Git

- **Idioma de la superficie de GitHub en inglés**: ramas (`sprint/NN-<slug>`, `feature/*`, `fix/*`, `docs/*`, `chore/*`), mensajes de commit (Conventional Commits), títulos y **body de PRs**, descripciones de repositorio, releases y changelog. El contenido técnico de `docs/` (specs, ADRs, flujos, convenciones) se escribe en español; solo lo que GitHub muestra públicamente (y el código) va en inglés.
- Ramas desplegables: `main` = producción y `staging` = pruebas (ADR 0010, `docs/flows/git.md`).
  No existe `develop`; la rama `production` se elimina.
- Un PR por sprint (no por tarea ni por cambio), en draft contra `staging` desde el arranque: el
  PR acumula los cambios del sprint y se squash-mergea a `staging` una sola vez, con orden
  explícita del usuario. El título del PR es el commit resultante. Las puertas de setup del
  usuario se documentan en ese mismo PR.
- **Regla dura: nada llega a `main` sin pasar por `staging`.** La promoción es un PR
  `staging → main` (checks en verde, aprobación del propietario) con orden explícita del
  usuario; tras cada release, merge `main → staging`. Única excepción: el `revert` de un
  hotfix con producción rota (`docs/flows/hotfix.md`).
- No mergees, no fuerces push ni reescribas historia compartida sin orden explícita del usuario.
- La tarea no es `finalizada` hasta cumplir `docs/conventions/definition-of-done.md`, incluida la auditoría de seguridad.
