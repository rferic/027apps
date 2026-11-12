---
id: sprint-14-task-02
titulo: Dependabot apuntando a staging y triaje de los PRs abiertos
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-11-10-dependabot-staging.md
fuente: docs/tasks/sprint-14-mejoras/README.md §Dependabot
adrs: [0010]
---

**Tarea**: que Dependabot no vuelva a abrir PRs contra `main` y dejar triados los que ya están
abiertos, sin mergear ninguno.

**Causa raíz**: `.github/dependabot.yml` no declara `target-branch`, así que usa la rama por
defecto del repositorio (`main`), que es la rama de producción. Eso contradice el flujo
`staging → main` del ADR 0010.

**Alcance**
- Dentro: añadir `target-branch: staging` a los tres ecosistemas (`npm`, `github-actions`,
  `gradle`); retargetear a `staging` los PRs abiertos que apunten a `main` (#34, #51, #52, #14)
  con `gh pr edit --base staging`; pedir rebase a los conflictivos (#33) y verificar los
  checks de cada uno; actualizar `docs/flows/cicd.md` con la regla.
- Fuera: mergear cualquier PR (requiere orden explícita); saltos mayores no verificados.

**Estado verificado (2026-11-10)**: #38 cerrado; lo sustituye #51. #33 y #39 en `staging`.
#34, #51, #52 y #14 en `main`. #33 y #14 con conflictos.

**Criterios de aceptación**:
- La config declara `target-branch: staging` en los tres ecosistemas y un PR nuevo de prueba
  nace contra `staging` (evidencia: run o PR de Dependabot).
- Todos los PRs abiertos apuntan a `staging`; los conflictivos tienen su rebase pedido.
- `docs/flows/cicd.md` lo documenta.
- Ningún merge ejecutado.

**Puertas de usuario**: la orden de mergear, PR por PR, cuando el propietario lo decida.

**Riesgos**: que un rebase de Dependabot fuerce push y cierre el PR; el lockfile puede requerir
`pnpm install` para regenerarse. Se valida en la rama del PR, nunca en `staging` directamente.

## Ejecución (2026-11-10)

- `.github/dependabot.yml`: `target-branch: staging` en los tres ecosistemas. Efectivo cuando el
  fichero llegue a `main` (Dependabot lee la config de la rama por defecto).
- PRs retargeteados a `staging`: #34, #51, #52 y #14; #33 y #39 ya estaban ahí.
- Rebase pedido a Dependabot en #33 y #14 (los dos conflictivos).
- Estado tras el cambio: #33/#14 `CONFLICTING`; #34/#39/#51/#52 `MERGEABLE`. Ninguno mergeado.
