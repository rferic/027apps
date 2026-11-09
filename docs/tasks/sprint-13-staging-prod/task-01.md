---
id: sprint-13-task-01
titulo: Modelo de entornos y ramas (ADR 0010 + spec + alineación de flujos)
area: infra
estado: en curso
plan: docs/superpowers/plans/2026-11-08-staging-production.md
fuente: docs/adr/0010-entornos-y-ramas.md; docs/superpowers/specs/2026-11-08-staging-production-design.md
adrs: [0010]
---

**Tarea**: registrar el ADR 0010 y la spec, y alinear `docs/flows/cicd.md`,
`docs/flows/git.md`, `docs/flows/release.md`, `docs/infrastructure.md` y `AGENTS.md` con el
modelo de dos ramas desplegables.

**Objetivo**: una documentación coherente que describa el modelo sin contradicciones.

**Contexto**: el modelo nuevo sustituye la rama placeholder `production`, la nota «*Production
Branch* → `main` al cierre de sprint-08-core-base» y la pausa de deploy por falta de Core.
Si una regla de `AGENTS.md` cambia, se hace aquí como cambio explícito (no edición silenciosa).

**Alcance**:
- Dentro: `docs/adr/0010-entornos-y-ramas.md` (verificado contra la spec),
  `docs/flows/cicd.md`, `docs/flows/git.md`, `docs/flows/release.md`,
  `docs/infrastructure.md`, `AGENTS.md`; y verificación cruzada de los ficheros que referencian
  estos flujos (`docs/flows/agents.md`, `docs/flows/feature.md`, `docs/flows/hotfix.md`,
  `docs/self-hosting.md`) para que no queden referencias obsoletas.
- Fuera: no se escribe ningún workflow, script, YAML ni configuración de Vercel/Supabase.

**Criterios de aceptación**:
- `cicd.md`, `git.md`, `release.md`, `infrastructure.md` y `AGENTS.md` describen el mismo
  modelo de la spec, sin contradicciones.
- `production` solo aparece como «borrar/eliminar», nunca como rama vigente; `develop` no
  aparece como rama del modelo.
- Rutas y comandos citados verificados contra el repo.
- Revisión de segundo agente (DoD de Docs); auditoría de seguridad si el texto toca secretos.

**Riesgos**: reescribir `AGENTS.md` sin pasar por el usuario (se reporta, no se decide);
referencias cruzadas que queden apuntando al modelo antiguo.
