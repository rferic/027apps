---
id: sprint-17-task-03
titulo: Editar liquidaciones desde su propio formulario
area: app
estado: finalizada
plan: docs/superpowers/plans/2026-11-23-sprint17-settlement-edit.md
fuente: docs/tasks/sprint-17-panel-y-notificaciones/README.md
adrs: [0007]
---

**Estado (2026-11-23)**: implementada y verificada; pendiente la revisión y la auditoría.

- `ManualPaymentDialog` gana modo edición (pagador, receptor, importe y fecha precargados, título
  «Editar pago» y borrado dentro del formulario cuando corresponde) y muestra el error del store.
- La fila de una liquidación abre ese diálogo; un gasto sigue abriendo el de gasto. La regla de
  quién puede editar no cambia (autor o creador del grupo): si no, la fila no se abre.
- Guardar llama a `store.updateMovement(..., kind = "settlement")` con **un** participante y el
  importe completo; crear sigue llamando a `settleUp`. `settlementParticipants` comparte la forma
  entre crear, editar y liquidar el plan.
- `editPayment` en los 9 idiomas y cuarta nota del changelog 0.21.0.
- Evidencia: `:app:testDebugUnitTest` y `:app:assembleDebug` BUILD SUCCESSFUL (incluye
  `OweSettlementEditTest` y `AppStringsTest` con las 9 locales); `pnpm lint` 0 errores; `pnpm tsc`
  7 áreas.

**Tarea**: que tocar un pago en Actividad abra el formulario de pago con sus datos, y no el de
gasto, que el servidor rechaza.

**Punto de partida**

- `canEdit` deja editar cualquier movimiento propio, incluidas las liquidaciones, y las manda a
  `ExpenseDialog` (`OweNoScreen.kt:1170`, `:1748`, `:1849`). Ese diálogo permite varios
  participantes y el servidor responde `a settlement has exactly one receiver`
  (`packages/owe-no/src/movements.ts:38-46`); el usuario ve un error genérico.
- `ManualPaymentDialog` existe con pagador, receptor, importe y fecha (`OweNoScreen.kt:2476`), pero
  solo crea: no recibe un movimiento que editar y reinicia los valores por defecto.
- El servidor ya acepta `PATCH /movements/{id}` con `kind: "settlement"` y un único receptor
  (`movements/[movementId]/route.ts:19-37`). No hay trabajo de API.

**Alcance**

- `ManualPaymentDialog` gana modo edición: precarga pagador, receptor, importe y fecha, y el botón
  pasa a guardar en vez de registrar.
- Tocar una liquidación abre ese diálogo; tocar un gasto sigue abriendo `ExpenseDialog`.
- Se conserva la regla de quién puede editar (autor o creador); si no puede, la fila no se abre.
- El borrado sigue disponible desde el propio diálogo, como hoy.
- 9 idiomas si hace falta texto nuevo; test de UI: editar una liquidación manda `kind: settlement`
  con un solo receptor y el importe completo.

**Aceptación**

- Una liquidación se corrige (pagador, receptor, importe o fecha) sin error del servidor y los
  saldos se recalculan.
- Un gasto sigue editándose en su formulario de siempre.
- Una liquidación ajena y de un grupo del que no eres creador no se puede abrir para editar.
- `pnpm lint`, `pnpm tsc`, `./gradlew :app:testDebugUnitTest` en verde.

- Revisión y auditoría (2026-11-23, agente distinto): **APTO** en calidad, OWASP y estilo, sin hallazgos. CI del PR en verde.

**Plan**: [2026-11-23-sprint17-settlement-edit](../../superpowers/plans/2026-11-23-sprint17-settlement-edit.md).
