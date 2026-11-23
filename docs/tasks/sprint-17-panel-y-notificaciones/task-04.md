---
id: sprint-17-task-04
titulo: Idempotencia del commit del importador
area: core + web + app
estado: finalizada
plan: docs/superpowers/plans/2026-11-23-sprint17-import-idempotency.md
fuente: docs/tasks/sprint-17-panel-y-notificaciones/README.md
adrs: [0004, 0007]
---

**Estado (2026-11-23)**: implementada y verificada; pendiente la revisión y la auditoría.

- `commitImport` acepta `idempotencyKey`; la comprobación va tras el candado y **antes** del
  `reset`, y el resultado se guarda en la misma transacción. La huella cubre `csv`, `mapping`,
  `newMembers` y `reset` (mapeo y miembros ordenados).
- La ruta lee `Idempotency-Key` (máx. 200) y el resumen de OpenAPI lo menciona.
- Panel y app guardan una clave por cuerpo: se reutiliza al reintentar y se renueva si cambia el
  fichero, el mapeo o el reset; el reintento interno tras un 401 conserva la cabecera.
- Evidencia: `owe-no-imports.test.ts` 15/15 (12 + 3 de idempotencia); `core` 638; `admin` 1364;
  Android BUILD SUCCESSFUL; `pnpm lint` 0 errores; `pnpm tsc` 7 áreas; `pnpm check:openapi`
  124/124.

**Tarea**: que el commit de una importación acepte `Idempotency-Key` y cumpla lo que la spec ya
promete: el mismo envío repetido devuelve el mismo resultado y no añade una segunda importación al
historial.

**Punto de partida**

- La spec lo promete dos veces: `2026-11-13-owe-no.md:470` («`POST` de movimiento e importación
  aceptan `Idempotency-Key`») y `:717-718` («se implementa en v1 para el alta de movimientos y para
  el commit del importador»).
- El alta de movimientos ya lo hace (`service.ts:572-590`, cabecera en `movements/route.ts:57`).
- El commit no: `importCommitSchema` no lleva la clave (`requests.ts:52-58`) y la ruta no lee la
  cabecera (`imports/route.ts`).
- La deducción por filas ya evita gastos repetidos, pero un reintento deja una segunda línea en el
  historial con «0 nuevos».

**Alcance**

- `commitImport` acepta la clave y la resuelve **dentro** de la transacción y del candado por grupo
  (tarea 01), reutilizando `module_owe_no.owe_no_idempotency`: misma clave y mismo cuerpo devuelven
  el resultado guardado; misma clave con otro cuerpo, `conflict` con código
  `idempotency_key_reused`.
- La huella cubre lo que cambia el resultado: `csv`, `mapping`, `newMembers` y `reset`. Un `reset`
  repetido devuelve el resultado guardado, **no** vuelve a borrar.
- La ruta del commit lee `Idempotency-Key` (máximo 200 caracteres, opcional para clientes viejos),
  igual que los movimientos.
- Panel y app generan una clave por intento de commit (`crypto.randomUUID()` / equivalente) y la
  reutilizan si el usuario reintenta o si el cliente refresca la sesión y repite; una clave nueva
  por clic no protege de nada.
- OpenAPI actualizado con la cabecera.

**Aceptación**

- Mismo cuerpo y misma clave: mismo resultado, cero movimientos nuevos y **una sola** línea en el
  historial.
- Misma clave y cuerpo distinto: `conflict`, sin escribir nada.
- Sin clave: comportamiento actual (deducción por filas).
- Un `reset` repetido con la misma clave no borra dos veces.
- `db-tests` de importaciones e idempotencia en verde; `pnpm check:openapi` en verde.

- Revisión y auditoría (2026-11-23, agente distinto): **APTO** en calidad, OWASP y estilo, sin hallazgos. CI del PR en verde.

**Plan**: [2026-11-23-sprint17-import-idempotency](../../superpowers/plans/2026-11-23-sprint17-import-idempotency.md).
