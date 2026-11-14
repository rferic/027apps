# Sprint 15 — Tareas programadas de módulos (plan, tarea 09)

**Goal:** que un módulo declare trabajo periódico y el Core lo ejecute sin cron propio.
**Tarea:** [`task-09`](../../tasks/sprint-15-app-y-finanzas/task-09.md) · **Contrato:**
[`module-system.md`](../../ai/module-system.md).

## Parte A — Contrato (hecho)

- [x] `jobs: [{ key, schedule, fn, timeout_seconds? }]`; cron de 5 campos validado al instalar.
- [x] Parser propio en `packages/core/src/modules/cron.ts`, evaluado en **UTC**; domingo 7→0;
      día del mes y día de la semana deben coincidir ambos.
- [x] `module_registry.jobs` (migración 0026) para no leer paquetes en cada minuto.
- [x] Tests de cron y del contrato (cron inválido, duplicados, timeout 1–300).

## Parte B — Despachador (hecho)

- [x] `module_job_runs` (0027) con `unique (module_key, job_key, scheduled_for)`: la fila es el claim.
- [x] `runDueModuleJobs`: módulos `active`, cron del minuto, claim, ejecución en transacción con
      `statement_timeout` y `search_path` del módulo, y registro `ok`/`error` con duración.
- [x] Un fallo se registra y no aborta el lote; un módulo `disabled` no ejecuta.
- [x] `GET /api/v1/maintenance/module-jobs` con `MAINTENANCE_CRON_SECRET` (Bearer, comparación
      en tiempo constante, 503 sin secreto).
- [x] `crons` cada minuto en `apps/admin/vercel.json`; variable documentada en `.env.example` y
      `infrastructure.md`.
- [x] Fixture **1.1.0**: migración nueva con `job_log` + `job_ping` y el job `ping`, listo para
      probar la actualización desde 1.0.0.
- [x] Tests `db-tests`: una vez por minuto, sin duplicar, siguiente minuto sí, desactivado no, y
      fallo registrado.

## Parte C — Panel (hecho)

- [x] Sección «Scheduled jobs» en la ficha: schedule, último estado y duración.
- [x] Botón **Run now** con `POST /modules/{key}/jobs/{job}/run` y claim por timestamp exacto
      (no roba el turno programado del minuto).
- [x] `runModuleJobNow` se niega si el módulo no está activo (`module_inactive`).
- [x] Tests: dos ejecuciones manuales seguidas cuentan dos, y el módulo inactivo se rechaza.

## Verificación

- [x] `core` 47 tests; `db-tests` módulos 28; `admin` 1141; `tsc` limpio.
- [ ] `next build` y preview con el cron.
- [ ] Aceptación en staging: actualizar el fixture y ver la fila de ejecución.
