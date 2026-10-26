# Plan — Sprint 03, task-02: Flujo de git (`docs/flows/git.md`)

**Fecha:** 2026-10-25
**Task:** `docs/tasks/sprint-03/task-02.md` (finalizada)
**Entregable:** `docs/flows/git.md`

Plan ligero reconstruido tras el hecho (el sprint de definición se trabajó por conversación de diseño directa con el usuario; constancia de los pasos ejecutados para la trazabilidad del AGENTS.md).

## Pasos ejecutados

1. **Conversación de diseño** con el usuario (2026-10-25): modelo "un sprint = un concepto", PR en draft desde el arranque para CI continuo, QA + auditoría por tarea, merge del PR como puerta de integración, protección de `main` como puerta de admin.
2. **Redacción de `docs/flows/git.md`**: modelo de ramas, integración a `main`, protección, tags/releases.
3. **Revisión por segundo agente** (DoD de Docs): hallazgo de CI por push corregido (draft PR) + ancla rota de `release.md` arreglada.
4. **Aprobación** por el usuario y commit en `sprint/03-token-model` (`02b57df`).

## Criterios de aceptación cumplidos

- `docs/flows/git.md` define ramas, integración, protección de `main` y relación de tags con `main`.
- Resuelve los TODOs de `feature.md` / `release.md` / `bugfix.md` que referenciaban `git.md` como destino.
- Revisado por segundo agente; rutas verificadas.

## Referencias

- Flujo: `docs/flows/git.md`
- CICD: `docs/flows/cicd.md`
- Release: `docs/flows/release.md`