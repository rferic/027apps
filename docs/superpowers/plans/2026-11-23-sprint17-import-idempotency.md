# Sprint 17 · Tarea 04 — Idempotencia del commit del importador

**Goal:** que el commit de una importación acepte `Idempotency-Key` y cumpla lo que la spec ya
promete: el mismo envío repetido devuelve el mismo resultado y no añade una segunda importación.

**Architecture:** se reutiliza `module_owe_no.owe_no_idempotency`, con la comprobación dentro de la
transacción y del candado por grupo (tarea 01) y **antes** del `reset`, para que un reintento no
vuelva a borrar. La huella cubre `csv`, `mapping`, `newMembers` y `reset`.

**Tech Stack:** `packages/owe-no`, ruta de Next, panel (server action + wizard), Android (`ApiClient`
y pantalla de importación). Sin migración.

**Spec:** [`docs/tasks/sprint-17-panel-y-notificaciones/task-04.md`](../tasks/sprint-17-panel-y-notificaciones/task-04.md)

## Pasos

- [x] `commitImport` acepta `idempotencyKey`; `importRequestHash` normaliza mapping y miembros.
- [x] La clave se comprueba tras el candado y antes de `reset`; el resultado se guarda en la misma
  transacción.
- [x] La ruta lee `Idempotency-Key` (máx. 200) y la pasa; el resumen de OpenAPI lo menciona.
- [x] Panel: una clave por cuerpo (se reutiliza al reintentar, se renueva si cambia el fichero, el
  mapeo o el reset).
- [x] App: la misma regla; el reintento interno tras un 401 conserva la cabecera.
- [x] Tests: mismo cuerpo/clave → mismo resultado y un solo lote; clave con otro cuerpo → `conflict`;
  `reset` repetido no vuelve a borrar.
