# Sprint 15 — Contrato versionado y actualización de módulos (plan, tarea 08)

**Goal:** que un módulo pueda evolucionar sin desinstalar: contrato versionado, actualización
transaccional que aplica solo migraciones nuevas y sincroniza settings, y un botón en el panel.
**Spec:** [`module-system.md`](../../ai/module-system.md) · **Tarea:**
[`task-08`](../../tasks/sprint-15-app-y-finanzas/task-08.md) · **Decisión:** D24 del sprint.

## Precondiciones

- [x] Tareas 02, 03 y 05 `finalizadas` (registro, settings, canal y demo).
- [ ] El propietario aprueba este plan.
- [ ] Fixture instalado en staging para aceptar la actualización.

## Parte A — Contrato versionado

- [x] `CORE_CONTRACT = 1` en `packages/core/src/version.ts`.
- [x] `contract` obligatorio en el manifest (zod + `manifest.schema.json`).
- [x] El instalador rechaza otro contrato con `contract_mismatch` y dice el esperado.
- [x] Test: instalar con `contract: 2` → rechazo; `contract: 1` → instala.
- [x] `module-system.md` con la regla (sube solo con cambios incompatibles).

## Parte B — `upgradeModule`

- [x] Valida manifest, `key`, contrato, digests y ficheros antes de tocar la base.
- [x] Solo si `version` es **estrictamente mayor**; misma o menor → `conflict` (`not_newer`).
- [x] Comprueba que las migraciones aplicadas existen en el manifest nuevo.
- [x] Aplica solo las migraciones nuevas en orden, en una transacción.
- [x] Actualiza `version`, `manifest_digest`, `scopes`, `app_visible` y `requires`; **no** toca
      `is_public` ni `mcp_exposed` (decisiones de la instancia).
- [x] `syncModuleSettings`: añade settings, relabela y retira los eliminados, conservando los
      valores guardados.
- [x] Emite `module.upgraded` con `from`/`to`.
- [x] Test: 1.0 → 1.1 añade una columna, conserva la fila, deja dos migraciones, añade un setting,
      retira otro y mantiene el valor del que sigue; misma/menor versión se rechaza.

## Parte C — API y panel

- [x] `POST /api/v1/modules/{key}/upgrade` (`modules:manage`), manifiesto leído del paquete.
- [x] `upgradeModule` en `module-mutations` + acción en `ModuleActions`.
- [x] La ficha muestra **Update vX** solo si el paquete es más nuevo que la instalada.
- [x] Tras actualizar, `router.refresh()` recarga versión, settings y estado.

## Verificación

- [x] `core` 42 tests; `db-tests` módulos 26; `admin` 1141; `i18n:check` e `tsc` limpios.
- [ ] `pnpm lint` completo, `next build` y preview.
- [ ] Actualización del fixture en staging con datos de prueba.

## Rollback

- La actualización es una transacción: una migración nueva que falla no deja el módulo a medias.
- No hay downgrade: volver atrás exige publicar una versión mayor con la migración inversa, o
  desinstalar (destructivo) y reinstalar.
