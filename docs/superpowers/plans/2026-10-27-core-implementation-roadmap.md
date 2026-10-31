# Plan — Implementación del Core (sprints 05, 06, 07) + sprint 08 (paralelo)

**Fecha:** 2026-10-27
**Specs:** sprint de diseño del Core (`docs/superpowers/specs/2026-10-26-*.md` + `2026-10-25-api-v1/token-model/auth.md`)
**Sprints:** `sprint-05-core-base` → `sprint-06-core-data` → `sprint-07-mcp` · `sprint-08-new-module-skill` (paralelo)

## Orden y dependencias

```
sprint-infra (04 Supabase+envs, 09 clave maestra)  ──┐
                                                     ▼
sprint-05-core-base  ──►  sprint-06-core-data  ──►  sprint-07-mcp
        │                        │
        └──► sprint-web (login + shell desde 05; páginas privadas tras 06)

sprint-08-new-module-skill (docs + skill, paralelo; no bloquea Core)
```

1. **sprint-05** es el cimiento: migraciones+RLS, auth, esqueleto de API, settings, i18n, observabilidad. **Nada más empieza sin él.**
2. **sprint-06** añade la superficie: personas, invitaciones, claves, módulos+instalador, realtime/outbox/push, jobs.
3. **sprint-07** añade MCP (necesita módulos y `mcp_exposed`).
4. **sprint-web** corre en paralelo: login y shell desde 05; páginas de gestión tras 06.
5. **sprint-08-new-module-skill** corre en paralelo: documentación canónica y skill `new-module`; no bloquea al Core; las fases ejecutables se verifican cuando exista el instalador.

## Reglas de ejecución

- **TDD por tarea** (rojo → verde → refactor); un test de regresión por bug.
- Cada tarea declara `adrs:` en el frontmatter y pasa la **checklist `security-checklist.md`** (auditoría incondicional).
- `pnpm lint && pnpm tsc && pnpm test` + `build` antes de cada commit; CI verde en el PR del sprint.
- Un **PR por sprint** (draft al arrancar, listo al cerrar) con squash merge, tras orden del usuario.

## Puertas

| Puerta | Cuándo |
|---|---|
| Supabase + envs (infra-04) y clave maestra (infra-09) | antes de sprint-05 |
| Revisión de plan de cada sprint (detallado al arrancar) | al inicio de 05/06/07 |
| Aceptación del resultado en preview (Vercel, infra-06) | al cerrar cada sprint |
| Merge a `main` | orden explícita del usuario |

## Riesgos

- **Migraciones + RLS son la base**: un error aquí contamina todo. La suite de aislamiento es obligatoria por tabla.
- **Instalador de módulos** (DDL en runtime): es la pieza con más superficie; se implementa con rol acotado, digest y confirmación.
- **Realtime/outbox**: el claim y el lease deben probarse con concurrencia y procesos muertos.
