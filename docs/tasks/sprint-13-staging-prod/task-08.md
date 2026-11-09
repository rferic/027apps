---
id: sprint-13-task-08
titulo: Keep-alive y runbook de release
area: infra
estado: pendiente
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
