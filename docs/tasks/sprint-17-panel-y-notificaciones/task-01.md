---
id: sprint-17-task-01
titulo: Import atómico y candado de duplicados
area: core + web + app
estado: test
plan: docs/superpowers/plans/2026-11-23-sprint17-import-atomic.md
fuente: docs/tasks/sprint-17-panel-y-notificaciones/README.md
adrs: [0004, 0007]
---

**Tarea**: que el commit de una importación sea atómico y que dos commits simultáneos del mismo
grupo no puedan duplicar movimientos, y que los miembros del mapeo nazcan dentro de esa misma
transacción.

**Estado (2026-11-23)**: implementada y verificada; pendiente de revisión y auditoría.

- El candado está cubierto por un test de regresión (`owe-no-imports.test.ts`, «two overlapping
  commits of the same file do not duplicate movements»): fallaba con `expected 2, received 4` y
  pasa.
- Los miembros nuevos se crean dentro de la transacción (`new_members`), y el panel y la app ya no
  crean miembros al mapear. Un commit que falla no deja ni miembros ni movimientos.
- Un miembro invitado (cuenta real) resuelve nombres como uno ficticio, que es lo que la spec ya
  decía (D15) y el filtro `active` impedía.
- Mensaje del límite corregido a 2 MB.
- Verificación: `owe-no-imports.test.ts` 12/12; `@027apps/core` 46/634; `admin` 172/1363;
  `@027apps/owe-no` 26/26; `:app:testDebugUnitTest` BUILD SUCCESSFUL; `pnpm lint` 0 errores;
  `pnpm tsc` 7 áreas; `pnpm check:openapi` 122/122; `pnpm i18n:check` 1116 cadenas/9 locales;
  `pnpm --filter admin build` OK. `db-tests` completo no se lanza contra la instancia del
  propietario (ver `docs/flows/pre-delivery-verification.md`); la suite de importaciones se cubre
  entera.
- Revisión (2026-11-23, dos agentes): los hallazgos se corrigieron en el mismo commit. El más
  grave: el test de concurrencia desinstalaba el módulo comprometido y podía borrar los datos
  locales de OweNo; ahora reutiliza una instalación existente y solo limpia el grupo que creó
  (probado con el módulo instalado: sigue instalado después). También: versión y changelog de la
  app, `reset` conserva el miembro mapeado aunque su nombre no coincida con el CSV, y el estilo
  (imports, nombres, enlaces de docs). Un `new_members` con un nombre repetido se rechaza
  (`duplicate_new_member`).
- Segunda ronda: el auditor de calidad y seguridad dio **APTO** (calidad y OWASP A01–A11, sin
  hallazgos nuevos); el de estilo pidió dos correcciones de texto y consistencia, ya aplicadas, y
  sus sugerencias quedaron cerradas salvo la deuda anotada abajo.
- Hallazgo colateral (revisión): `pnpm db:restore` no restauraba los esquemas de módulos, así que
  tras un reset el módulo quedaba «instalado» sin sus tablas y sus datos se perdían aunque el dump
  los tuviera. Corregido en `scripts/db-local-restore.sh`: recrea `module_*` con su DDL, sus datos,
  su dueño (`postgres`) y el permiso de `module_installer`. Verificado con un reset simulado (drop
  del esquema y de su fila de registro) y una segunda ejecución: 1 grupo / 1 movimiento intactos y
  la suite de importaciones 12/12 después. El flujo queda anotado en `docs/flows/local-development.md`.
- Deuda aceptada de la revisión: el helper de instalación se repite entre los tests del fichero, y
  el esquema de `new_members` vive duplicado en el módulo y en OpenAPI (la duplicación ya existía
  para el resto del commit).

**Punto de partida**

- `commitImport` lee las huellas ya importadas **antes** de abrir la transacción
  (`packages/owe-no/src/importer.ts:251`) y toma el `pg_advisory_xact_lock` dentro (`:262`). El
  comentario de `:261` dice lo contrario. Dos commits solapados leen el mismo conjunto vacío y
  ambos insertan las filas: **gastos duplicados**.
- El panel crea los miembros del mapeo **antes** de llamar a `commitImport`
  (`apps/admin/src/lib/owe-no-import-actions.ts:66-84`): un commit que falle los deja creados.
- La app crea el miembro al elegir un nombre en el mapeo (`OweImportScreen.kt:127-145`): cancelar
  deja el grupo tocado. Es el fallo que vio el propietario.
- El mensaje de `assertSize` dice «400 KB» y el límite es 2 MB (`importer.ts:9` y `:55`).

**Alcance**

- Mover la lectura de `knownHashes` (y el cálculo de `rows`/`duplicates`) dentro de `run`, después
  del candado; el `reset` sigue borrando antes de leer, como ya hace.
- `commitImport` acepta `newMembers: Array<{ name: string; displayName?: string; userId?: string }>` y los crea dentro de
  la transacción con el `scoped` (`importer.ts:305`), reutilizando la lógica de `addMember`
  (`service.ts:257`) sin copiarla.
- Esquema zod del commit con `new_members`, OpenAPI al día.
- Panel: `importCommitAction` manda `newMembers` y deja de llamar a `addMember`.
- App: el mapeo guarda la elección en memoria (nombre → cuenta o ficticio) y la manda en el commit;
  `ApiClient.oweImportCommit` y el DTO del cuerpo ganan el campo.
- Mensaje del límite corregido a 2 MB.

**Aceptación**

- Dos commits concurrentes del mismo CSV: uno crea, el otro no duplica ni un movimiento; el
  historial no miente en los contadores.
- Un commit que falla después de crear miembros no deja ni miembros ni movimientos.
- Cancelar el mapeo en la app no llama a `POST /members` ni deja miembros.
- El mismo CSV con una fila extra sigue importando solo la nueva.
- `db-tests` de importaciones y de concurrencia en verde; tests de panel y de app en verde.
- `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm --filter admin build` y
  `./gradlew :app:testDebugUnitTest` en verde.

**Plan**: [2026-11-23-sprint17-import-atomic](../../superpowers/plans/2026-11-23-sprint17-import-atomic.md), tareas 1–5.
