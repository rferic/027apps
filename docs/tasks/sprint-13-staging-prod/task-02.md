---
id: sprint-13-task-02
titulo: Protección de ramas y contrato de promoción
area: infra
estado: pendiente
plan: docs/superpowers/plans/2026-11-08-staging-production.md
fuente: docs/superpowers/specs/2026-11-08-staging-production-design.md §7
adrs: [0010]
---

**Tarea**: documentar (y dejar listos para ejecutar) la protección de `main` y `staging` y el
contrato de promoción.

**Objetivo**: que ningún push directo, force-push o merge sin checks llegue a `staging` o
`main`.

**Contexto**: hoy `main` no está protegida; la disciplina la impone `AGENTS.md`. La protección
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
