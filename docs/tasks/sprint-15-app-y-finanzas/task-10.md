---
id: sprint-15-task-10
titulo: Módulo — acciones de la app declaradas en el manifest
area: core
estado: pendiente
fuente: docs/ai/module-system.md; docs/superpowers/specs/2026-11-12-android-access-shell.md (§FAB)
adrs: [0004, 0007]
---

**Tarea**: que el botón de añadir de la app deje de tener una lista hardcodeada. Cada módulo
declara sus acciones rápidas (OweNo: «Gasto») y la app compone el FAB con las de los módulos a los
que el usuario tiene acceso.

**Alcance**
- Dentro:
  - **Contrato**: `app_actions: [{ key, label, icon, module, screen }]`; `screen` es una ruta
    interna del registro de pantallas del módulo en la app (no una URL ni HTML). Solo se admiten
    en módulos con `app.visible: true`. Cambio `module-contract`: esquema, docs, ejemplos y
    envoltorios.
  - `GET /api/v1/me/modules` incluye `app_actions` de cada módulo con acceso y estado `active`;
    sin acceso, no se exponen.
  - El FAB de la app (tarea 07) se compone de esas acciones; sin módulos con acciones, el FAB no
    aparece. Las etiquetas se traducen en la app a partir de claves de i18n del módulo.
  - El panel muestra las acciones declaradas en la ficha (solo lectura) para que el admin sepa
    qué ofrece el módulo.
- Fuera: acciones de panel; deep links arbitrarios; acciones que no sean del registro de la app.

**Dependencias**: tareas 03 y 08 `finalizadas`; la tarea 07 consume el contrato.

**Riesgos**: un `screen` que no existe en la app deja una acción muerta; acciones duplicadas entre
módulos; exponer acciones de módulos sin acceso; etiquetas sin traducir.

**Criterios de aceptación**
- El fixture declara dos acciones; `/me/modules` las devuelve para un usuario con acceso y no para
  uno sin él.
- El manifest rechaza `app_actions` en un módulo con `app.visible: false`, un `screen` vacío y
  claves duplicadas.
- La app muestra en el FAB las acciones de sus módulos activos, traducidas, y ninguna si no hay.
- El panel las muestra en la ficha sin poder editarlas.
- `docs/ai/module-system.md`, `docs/ai/manifest.schema.json` y los envoltorios actualizados.
- `pnpm lint`, `pnpm tsc`, `pnpm test` y `pnpm --filter db-tests test` en verde.

**Puertas de usuario**
- Aprobar el plan.
- Aceptar el FAB en la app con al menos dos módulos.
- Orden explícita de merge.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (filtrado por acceso, rutas internas
y etiquetas).
