---
id: sprint-13-task-08
titulo: Keep-alive y runbook de release
area: infra
estado: test
plan: docs/superpowers/plans/2026-11-08-staging-production.md
fuente: docs/flows/cicd.md; docs/superpowers/specs/2026-11-08-staging-production-design.md §8, §9
adrs: [0010]
---

**Tarea**: subir el secret `PROD_URL` para activar el keep-alive diario y dejar documentado el
runbook de promoción/rollback (código y migraciones).

**Traslado** (2026-11-08): viene de `sprint-11-prod-activation/task-01` (que era opcional y
solo cubría `PROD_URL`). Aquí se amplía para incluir el runbook de release del modelo de dos
ramas, una vez exista `027apps-prod` (tarea 06).

**Objetivo**: producción vigilada (keep-alive contra el pausado por inactividad de Supabase
Free) y un runbook ejecutable para promocionar y revertir.

**Alcance**:
- Dentro: secret `PROD_URL` con `https://027apps.ericrf.com` (puerta de usuario); runbook de
  promoción (rama → PR a `staging` → pruebas → PR `staging → main`), rollback de código
  (`git revert` + Vercel) y de migraciones (corregir hacia delante), en `docs/flows/cicd.md` y
  `docs/flows/release.md`.
- Fuera: no se crea el tag ni se publica el APK (eso es el flujo normal de release).

**Criterios de aceptación**:
- `PROD_URL` cargado y keep-alive diario en verde.
- Runbook documentado: pasos de promoción, rollback de código y rollback de migraciones.
- Rutas y comandos verificados contra el repo.

**Puertas de usuario**: subir `PROD_URL` (GitHub Secrets); aprobar el primer merge a `main`.

**Riesgos**: `PROD_URL` erróneo (keep-alive apunta mal); runbook de migraciones que invite a
`git revert` (se corrige hacia delante, no se revierte).

## Ejecución (2026-11-10)

- **`PROD_URL`** cargado como secret de repo con `https://027apps.ericrf.com` (verificado por
  API). El keep-alive diario (06:17 UTC) pide `${PROD_URL}/api/health`.
- **Evidencia**: `workflow_dispatch` de `keep-alive.yml` en verde (run `42779087187`) y el ping
  manual a `https://027apps.ericrf.com/api/health` devuelve `{"status":"ok"}`.
- **Runbook**: la promoción (rama → PR a `staging` → pruebas → PR `staging → main`), el
  rollback de código (`git revert` + Vercel) y el de migraciones (corregir hacia delante) están
  en `docs/flows/cicd.md` (§Despliegues, §Rollback) y `docs/flows/git.md` (§3 y §4).
- **Configuración de ramas** (2026-11-10): `staging` admite squash y merge; los PRs de trabajo
  se squash-mergean y la promoción `staging → main` y la sincronización `main → staging` usan
  **merge commit**, de modo que `main` conserva el historial de `staging` y las promociones
  siguientes no necesitan `--admin`.

**Pendiente**: revisión de otro agente y auditoría de seguridad para `finalizada`.
