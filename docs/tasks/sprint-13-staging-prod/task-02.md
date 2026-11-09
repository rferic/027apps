---
id: sprint-13-task-02
titulo: Protección de ramas y contrato de promoción
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-11-08-staging-production.md
fuente: docs/superpowers/specs/2026-11-08-staging-production-design.md §7
adrs: [0010]
---

**Tarea**: documentar (y dejar listos para ejecutar) la protección de `main` y `staging` y el
contrato de promoción.

**Objetivo**: que ningún push directo, force-push o merge sin checks llegue a `staging` o
`main`.

**Contexto**: verificado el 2026-11-09 con `gh api`: `main` ya tiene el ruleset `main-protection` (PR, sin force-push ni borrado) pero sin los checks `supabase` y `ai-docs`; `staging` no tiene protección. La disciplina la impone `AGENTS.md` mientras tanto. La protección
es acción de administrador (no automatizable con `gh` sin acceso admin).

**Alcance**:
- Dentro: pasos exactos de protección (Settings → Branches/rulesets): PR obligatorio, checks
  requeridos `admin`, `android`, `supabase`, `guard-secrets`, `commitlint`, `ai-docs` y el
  check de Vercel, sin force-push ni borrado; aprobación del propietario en `main`; contrato de
  promoción (rama → PR a `staging` → pruebas → PR `staging → main`) y sincronización
  `main → staging` tras cada release.
- Fuera: no se ejecuta la protección (puerta de usuario); no se cambia CI.

**Criterios de aceptación**:
- Documentados los pasos para ambas ramas y los checks requeridos (coincidentes con los jobs
  reales de `ci.yml`).
- Documentado el contrato de promoción y la regla dura «nada a `main` sin pasar por
  `staging`».
- La acción de administrador queda registrada como **puerta de usuario**.

**Puertas de usuario**: protección de ramas y rulesets (administrador del repo).

**Riesgos**: olvidar el check de Vercel en los checks requeridos; proteger `main` antes de que
el modelo de ramas esté documentado (orden: tarea 01 → 02).

## Ejecución (2026-11-09)

Por autorización expresa del usuario para las acciones de administrador de GitHub de este sprint, se ejecutó con `gh api` y se verificó por lectura: `main-protection` con `supabase` y `ai-docs` añadidos y métodos de merge `merge`+`squash`; `protect-staging` creado con los siete checks, PR obligatorio, sin force-push ni borrado, solo `squash`; rebase merge desactivado a nivel de repo. Los Environments `staging` y `production` se crearon sin secrets (puerta de la tarea 04).
