---
id: sprint-13-task-04
titulo: Migraciones por entorno
area: infra
estado: test
plan: docs/superpowers/plans/2026-11-08-staging-production.md
fuente: docs/superpowers/specs/2026-11-08-staging-production-design.md §5
adrs: [0010]
---

**Tarea**: crear los jobs de migraciones: a `027apps-dev` al mergear a `staging`, y a
`027apps-prod` al mergear a `main`, este último detrás del Environment `production`.

**Objetivo**: que cada entorno aplique sus migraciones de forma automática y ordenada, sin
tocar datos reales sin aprobación.

**Contexto**: hoy **no existe** job de migraciones; se aplican a mano con `supabase link` +
`supabase db push`. `staging` aplica sobre `027apps-dev`; `main` sobre `027apps-prod`.

**Alcance**:
- Dentro: job `staging` (`SUPABASE_ACCESS_TOKEN` + ref `wrigkwhrihawvwiciouy`, `supabase db
  push`); job `main` (`environment: production` con *required reviewer*, verificación previa
  del nivel de migraciones con `supabase migration list --linked`, y backup manual antes de
  cambios destructivos). Ambos se omiten sin fallar si falta `SUPABASE_ACCESS_TOKEN` (patrón
  del backup).
- Fuera: no se crea `027apps-prod` (tarea 06); no se escribe SQL.

**Criterios de aceptación**:
- Merge a `staging` → migraciones aplicadas a `027apps-dev` (evidencia de run).
- Merge a `main` → migraciones a `027apps-prod` solo tras la aprobación del *required reviewer*.
- Sin token (fork), el job termina en verde omitiéndose.
- Antes de una migración destructiva, backup manual documentado como paso previo.

**Puertas de usuario**: Environment `production` con required reviewer (GitHub).

**Riesgos**: tocar datos reales sin aprobación; migraciones no compatibles hacia atrás; el ref
de `027apps-prod` no existe aún (se cita por nombre).

## Implementación y evidencia

- `.github/workflows/migrations.yml`: `migrate-dev` (rama `staging`, Environment `staging`, ref fijo de `027apps-dev`) y `migrate-prod` (rama `main`, Environment `production`, ref de la variable `SUPABASE_PROJECT_REF`). `permissions: {}` a nivel de workflow, `contents: read` por job, `concurrency` por rama sin cancelar, CLI y `setup-cli` fijados igual que el job `supabase` de `ci.yml`, secrets solo por `env` de cada paso.
- Disparo: `push` a `staging`/`main` que toque `supabase/migrations/**` y `workflow_dispatch` (este último solo actúa en esas dos ramas por el `if` del job).
- Producción: `migration list --linked` y `db push --dry-run` antes de `db push --yes`; el *required reviewer* aprueba antes de que arranque el job.
- Omisión sin fallar: paso «Check configuration» como en `backup.yml`. Verificado ejecutando el script real con y sin credenciales: sin token → `enabled=false` (exit 0); en producción, token sin `SUPABASE_PROJECT_REF` → `enabled=false` (nunca cae al ref de dev).
- **Límite de la evidencia:** no hay run real del job. Requiere el Environment, los secrets y un merge a `staging`/`main` (puertas de usuario y orden de merge). Se verifica por lectura del YAML, parseo y ejecución local de la lógica de guarda.

### Desviaciones de la spec §6 (a confirmar)

1. Los secrets de migraciones van en **Environments** (`staging`, `production`), no a nivel de repositorio: una rama de PR con escritura no puede leerlos. Añade un Environment `staging` que la spec no menciona.
2. Se añade `SUPABASE_DB_PASSWORD` (opcional) y la variable `SUPABASE_PROJECT_REF` de `production`.
