---
id: sprint-15-task-08
titulo: Módulo — contrato versionado y actualización sin desinstalar
area: core
estado: pendiente
fuente: docs/ai/module-system.md; packages/core/src/modules/service.ts
adrs: [0007]
---

**Tarea**: que un módulo pueda evolucionar sin perder datos. Hoy la única forma de cambiar la
versión es desinstalar (y el `down` borra el esquema): inaceptable en cuanto OweNo publique su
primera corrección. Incluye el contrato versionado que hace segura la actualización.

**Alcance**
- Dentro:
  - **Contrato**: `contract` (entero) en el manifest y `CORE_CONTRACT` exportado por el Core. El
    instalador y la actualización exigen **igualdad**; un contrato distinto se rechaza con un
    mensaje que dice cuál espera el Core. Un cambio aditivo del contrato **no** sube el número;
    uno incompatible sí, y se documenta en `module-system.md` y en el esquema.
  - **`upgradeModule(deps, caller, key, manifest)`**: valida manifest, `key`, `contract`, que la
    versión sea **mayor** que la instalada, digests y ficheros; aplica solo las migraciones
    nuevas en orden dentro de una transacción; actualiza `version`, `manifest_digest`, `scopes`,
    `app_visible`, `requires` y `is_public`; añade settings nuevos y retira los eliminados
    (conservando el valor de los que siguen); registra `module_migrations`. Sin downgrade.
  - **Panel**: la ficha muestra la versión instalada y, si el paquete tiene una mayor, un botón
    **Actualizar a vX** con confirmación; nunca ofrece bajar de versión.
  - **Desinstalar** sigue siendo la vía destructiva y no cambia.
  - Si una migración nueva falla, no se aplica nada (transacción) y el módulo queda como estaba.
- Fuera: downgrades; migraciones de datos entre módulos; actualización automática sin pulsar.

**Dependencias**: tareas 02, 03 y 05 `finalizadas` (registro, settings y demo).

**Riesgos**: una migración nueva que borre datos sin querer (el `down` no se ejecuta en una
actualización); settings eliminados que el módulo todavía usa; una versión que no sube y se
rechaza; paquetes con el mismo contrato pero comportamiento distinto.

**Criterios de aceptación**
- Instalar 1.0.0, actualizar a 1.1.0 con una migración nueva: la tabla nueva existe, los datos de
  la tabla vieja siguen, el registro dice 1.1.0 y `module_migrations` tiene las dos versiones.
- Un manifest con `contract` distinto de `CORE_CONTRACT` no instala ni actualiza; el error nombra
  el contrato esperado.
- Actualizar a la misma versión o a una menor se rechaza con `conflict`.
- Un setting nuevo aparece tras actualizar; uno retirado desaparece del panel y de la tabla;
  los valores de los que siguen no cambian.
- Una migración nueva que falla no deja el módulo a medias.
- `docs/ai/module-system.md`, `docs/ai/manifest.schema.json` y `docs/flows/new-module.md`
  actualizados con el contrato y la actualización.
- `pnpm lint`, `pnpm tsc`, `pnpm test` y `pnpm --filter db-tests test` en verde.

**Puertas de usuario**
- Aprobar el plan.
- Aceptar la actualización del fixture en staging.
- Orden explícita de merge.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (DDL aplicado sobre datos reales,
transacción, settings retirados y digests).
