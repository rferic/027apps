---
id: sprint-infra-task-01
titulo: Proteger main (ruleset)
area: infra
estado: pendiente
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: docs/flows/cicd.md §A.1
---

Sprint de **infra (previo al Core)**: preparar cuentas y entorno; no es código de producto. Puerta de setup del usuario.

**Tarea**: proteger `main` en GitHub (Settings → Branches o ruleset): exigir PR, los cuatro checks (`admin`, `android`, `guard-secrets`, `commitlint`) y el check de Vercel cuando esté conectado; sin force-push ni borrado. Acción de administrador, no ejecutable por agente.
