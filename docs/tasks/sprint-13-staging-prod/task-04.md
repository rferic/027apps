---
id: sprint-13-task-04
titulo: Migraciones por entorno
area: infra
estado: pendiente
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
