---
id: sprint-13-task-03
titulo: CI en dos entornos
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-11-08-staging-production.md
fuente: docs/superpowers/specs/2026-11-08-staging-production-design.md §4; docs/flows/cicd.md
adrs: [0010]
---

**Tarea**: extender `.github/workflows/ci.yml` para que `staging` también corra los gates al
recibir un push, sin abrir producción a forks.

**Objetivo**: el merge a `staging` queda verificado por CI igual que `main`.

**Contexto**: hoy `ci.yml` dispara en `pull_request`, push a `main` y tags `v*`. Hay que añadir
push a `staging` manteniendo `concurrency`, `permissions: contents: read` y `commitlint` solo
en `pull_request`.

**Alcance**:
- Dentro: `push.branches` incluye `staging`; los jobs con secrets mantienen sus guardas
  (`if`/`env`); sin `pull_request_target`.
- Fuera: no se crea el job de migraciones (tarea 04); no se tocan `keep-alive.yml` ni
  `backup.yml`.

**Criterios de aceptación**:
- Un push a `staging` corre `admin`, `android`, `supabase`, `guard-secrets`, `ai-docs` (y
  `commitlint` no corre en push).
- Ningún PR de fork recibe secrets ni dispara deploy de producción.
- Coste anotado: repo público → minutos de Actions sin coste.
- Evidencia real de comportamiento (run en verde + run que falla cuando debe fallar).

**Riesgos**: ampliar el trigger y romper el `concurrency`; que un fork alcance producción por
un `pull_request_target` mal introducido.

## Evidencia

- Cambio: `push.branches: [main, staging]` en `.github/workflows/ci.yml`; `commitlint` sigue con `if: github.event_name == 'pull_request'`, `release` solo en tags `v*`, sin `pull_request_target`, los únicos `secrets.*` siguen en `release`.
- Run en verde sobre el PR #45 (commit `f24b8ee`, run `42589880704`): `admin`, `android`, `supabase`, `guard-secrets`, `commitlint`, `ai-docs` en `success`; `release` en `skipped`.
- Run que falla cuando debe: con un título de PR no convencional, `commitlint` termina en `failure` (run `42590302266`); con el título restaurado, run `42590404382` completo en verde (`release` en `skipped`).
- **Límite de la evidencia:** el run por `push` a `staging` solo existirá en el primer merge a `staging` (requiere orden de merge del usuario); aquí se verifica por lectura del YAML y por el run de `pull_request`.
