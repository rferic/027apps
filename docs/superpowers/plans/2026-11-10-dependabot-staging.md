# Sprint 14 — Dependabot contra `staging` (plan de implementación)

**Goal:** que las actualizaciones de dependencias nazcan y se mantengan contra `staging`, y
dejar triados los PRs abiertos, sin mergear ninguno.

**Fuente:** [`docs/tasks/sprint-14-mejoras/task-02.md`](../../tasks/sprint-14-mejoras/task-02.md) ·
[ADR 0010](../../adr/0010-entornos-y-ramas.md).

## Global Constraints

- **Ningún merge** sin orden explícita del propietario.
- Dependabot lee `.github/dependabot.yml` de la **rama por defecto** (`main`): el arreglo es
  efectivo cuando el cambio llegue a `main`, no antes.
- No se toca el código de las ramas de Dependabot a mano: el rebase lo hace el bot.

## Task 1 — Configuración

- [x] Añadir `target-branch: staging` a `npm`, `github-actions` y `gradle`.
- [x] Documentarlo en `docs/flows/cicd.md`.
- [ ] Verificar, tras el merge a `main`, que un PR nuevo nace contra `staging`.

**Verificación:** el siguiente PR de Dependabot tiene `base: staging`.

## Task 2 — Triaje de los PRs abiertos

- [x] Retargetear a `staging`: `#34`, `#51`, `#52`, `#14`.
- [x] Pedir rebase de los conflictivos: `#33`, `#14`.
- [ ] Confirmar que los rebases quedan `MERGEABLE` y con CI en verde.
- [ ] Revisar los saltos mayores (`#33` eslint 10, `#14` TypeScript 7, `#34` @types/node 26)
  antes de proponer merge.

## Task 3 — Prioridad de merge (solo cuando el propietario lo ordene)

1. `#39` (actions) — limpio, riesgo bajo.
2. `#51` (gradle) — limpio.
3. `#52` (grupo npm) — revisar el lockfile y el build.
4. `#34` (@types/node) — alinear con la versión de Node del proyecto.
5. `#33` (eslint 10) — conflicto; requiere rebase y comprobar reglas nuevas.
6. `#14` (TypeScript 7) — salto mayor; merece su propio PR de sprint.
