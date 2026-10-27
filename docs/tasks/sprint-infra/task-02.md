---
id: sprint-infra-task-02
titulo: Ruleset de tags v*
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: docs/flows/cicd.md §A.2
---

**Tarea**: ruleset para tags (Rules → Rulesets), target *Tags*, patrón `v*`, restringir creación/actualización/borrado a administradores del repo. Puerta de setup del usuario.

## Evidencia (2026-10-27, aplicado por el agente con `gh api`)

- **Ruleset `tags-v-protection`** (id `25965641`, `active`, target tag, patrón `refs/tags/v*`): reglas `creation`, `update` y `deletion`; **bypass `RepositoryRole` admin** (sin bypass nadie podría etiquetar, ni el dueño).
- **Config verificada** con `gh api repos/rferic/027apps/rulesets/25965641` (se guarda la salida como evidencia; no se empuja un tag de prueba porque un `v*` dispara el job `release`, que falla a propósito sin keystore).
- **Limitación honesta**: no se puede demostrar la denegación a un **no-admin** sin una segunda cuenta con escritura; la evidencia es la configuración activa.
- **Auditoría (DoD Infra)**: impide que un colaborador cree/mueva/borre tags `v*` y, con ellos, dispare un `release` sobre un commit arbitrario con acceso al keystore.
