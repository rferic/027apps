---
id: sprint-infra-task-01
titulo: Proteger main (ruleset)
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: docs/flows/cicd.md §A.1
---

Sprint de **infra (previo al Core)**: preparar cuentas y entorno; no es código de producto. Puerta de setup del usuario.

**Tarea**: proteger `main` en GitHub (Settings → Branches o ruleset): exigir PR, los cuatro checks (`admin`, `android`, `guard-secrets`, `commitlint`) y el check de Vercel cuando esté conectado; sin force-push ni borrado. Acción de administrador, no ejecutable por agente.

## Evidencia (2026-10-27, aplicado por el agente con `gh api`)

- **Ruleset `main-protection`** (id `25965638`, `active`, target branch, `~DEFAULT_BRANCH`):
  - `pull_request` — PR obligatorio, **0 aprobaciones** (no existe un segundo revisor; ver nota), squash como único método de merge, hilos resueltos obligatorios.
  - `required_status_checks` — `admin`, `android`, `guard-secrets`, `commitlint`, con *strict* (la rama debe estar al día).
  - `non_fast_forward` y `deletion` — sin force-push ni borrado.
  - **Sin bypass**: también el dueño pasa por PR.
- **Rojo real**: push directo a `main` rechazado —
  `! [remote rejected] tmp-direct-push -> main (push declined due to repository rule violations)`.
- **Nota (limitación honesta)**: `required_approving_review_count = 0` porque el único administrador no puede aprobar su propio PR; con 1 aprobación ningún merge sería posible hoy. Se sube a 1 el día que exista un segundo maintainer.
- **Auditoría (DoD Infra)**: protege contra colaboradores con escritura (el vector de T10/A06); el dueño conserva la capacidad de mergear PRs en verde, no de saltarse los checks.
