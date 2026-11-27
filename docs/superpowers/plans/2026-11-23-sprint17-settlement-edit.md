# Sprint 17 · Tarea 03 — Editar liquidaciones

**Goal:** que tocar un pago en Actividad abra el formulario de pago con sus datos, y no el de gasto,
que el servidor rechaza.

**Architecture:** el `PATCH` del servidor ya acepta `kind: settlement` con un único receptor y el
importe completo, así que la tarea es toda de app: el formulario de pago gana modo edición, la fila
decide qué diálogo abrir según `kind`, y la actualización reutiliza `store.updateMovement`.

**Tech Stack:** Android Kotlin + Compose, sin cambios de API ni de base de datos.

**Spec:** [`docs/tasks/sprint-17-panel-y-notificaciones/task-03.md`](../tasks/sprint-17-panel-y-notificaciones/task-03.md)

## Pasos

- [x] `ManualPaymentDialog(members, currency, saving, editing, canDelete, onDelete, onDismiss,
  onSave)`: precarga pagador, receptor, importe (`plainAmount`) y fecha; título «Editar pago»;
  borrado dentro del formulario cuando el usuario puede.
- [x] La fila de un movimiento con `kind = settlement` abre el diálogo de pago; un gasto sigue
  abriendo el de gasto. Solo si el usuario puede editar (autor o creador), como hoy.
- [x] Guardar una edición llama a `store.updateMovement(..., kind = "settlement")` con **un**
  participante (el receptor) y el importe completo; crear sigue llamando a `settleUp`.
- [x] `settlementParticipants(receiver, amount)` compartido por crear, editar y liquidar el plan.
- [x] `editPayment` en los 9 idiomas y nota en el changelog de 0.21.0.
- [x] Test: un participante, el receptor elegido y el importe completo.
