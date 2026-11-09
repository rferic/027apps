# Sprints — índice y orden

Los sprints se numeran **al crearse**, por el primer commit que añade su directorio. El número es
estable: no se reutiliza ni se reordena. Este índice es la fuente del orden real.

| # | Sprint | Arrancado | Estado |
|---|---|---|---|
| 1 | `sprint-01` | 2026-10-24 | finalizada |
| 2 | `sprint-02` | 2026-10-25 | finalizada |
| 3 | `sprint-03` | 2026-10-25 | finalizada |
| 4 | `sprint-04-infra` | 2026-10-25 | finalizada |
| 5 | `sprint-05-core-design` | 2026-10-25 | finalizada |
| 6 | `sprint-06-web` | 2026-10-27 | finalizada |
| 7 | `sprint-07-mcp-oauth` | 2026-10-27 | pendiente |
| 8 | `sprint-08-core-base` | 2026-10-27 | finalizada |
| 9 | `sprint-09-core-data` | 2026-10-27 | finalizada |
| 10 | `sprint-10-mcp` | 2026-10-27 | pendiente |
| 11 | `sprint-11-prod-activation` | 2026-11-01 | absorbida por sprint-13 |
| 12 | `sprint-12-new-module-skill` | 2026-11-06 | finalizada |
| 13 | `sprint-13-staging-prod` | 2026-11-08 | en curso |

## Regla

1. El número se asigna cuando el sprint arranca (primer commit de su directorio) y no cambia.
2. El directorio es `docs/tasks/sprint-NN-<slug>/`; el `id` de la tarea es `sprint-NN-task-MM`.
3. Al crear un sprint nuevo: número siguiente libre, entrada en esta tabla y rama `sprint/NN-<slug>`.
