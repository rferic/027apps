# Backlog — trabajo anotado y no planificado

Ideas y mejoras aceptadas por el propietario que **no** entran en el sprint en curso. Cada entrada
dice qué se quiere, por qué, qué decisiones faltan y qué toca (app, servidor o panel). Cuando una
entrada entra en un sprint se convierte en `docs/tasks/sprint-NN-<slug>/task-MM.md` y se borra de
aquí.

| # | Título | Área | Anotado | Origen |
|---|---|---|---|---|
| 1 | Ajuste para activar/desactivar las notificaciones push | app + servidor | 2026-11-15 | propietario, tras verificar la push real |
| 2 | Editar una liquidación abre el formulario de gasto | app | 2026-11-15 | auditoría de seguridad del sprint 15 |
| 3 | El importador crea miembros antes de confirmar | app + servidor | 2026-11-15 | auditoría de seguridad del sprint 15 |
| 4 | Idempotencia también en el commit del importador | servidor | 2026-11-15 | auditoría de seguridad del sprint 15 |
| 5 | El importador del panel no parece un sitio donde se sube un fichero | panel | 2026-11-16 | propietario, probando producción |
| 6 | Eliminar una instancia guardada en la app | app | 2026-11-18 | propietario, probando la migración por QR |

> Las entradas 1–3 y 5 están agrupadas en el **sprint 17**
> ([`sprint-17-panel-y-notificaciones`](sprint-17-panel-y-notificaciones/README.md)), a la espera de
> la aprobación del propietario. El sprint 16 es el flujo de invitación, sesión y migración de
> teléfono.

> Cerrado en esta ronda y retirado de aquí: RLS del módulo alineada con el dominio (migración
> `1.8.0`), monedas separadas en widget y panel, token FCM que caduca tras una rotación, la espera
> fija de la tarjeta de Inicio, cobertura de los 9 idiomas por reflexión y la versión del APK bajo
> el botón de descarga (era la tarea 12 del sprint).

---

## 1. Ajuste para activar/desactivar las notificaciones push

**Qué se quiere.** Un interruptor propio en la app, en **Ajustes → Notificaciones**, que permita
apagar y volver a encender las notificaciones sin salir de la aplicación ni ir a los ajustes del
sistema. Hoy la fila solo informa del estado del registro y permite reintentarlo.

**Por qué.** La app pide el permiso del sistema a la primera y, a partir de ahí, la única forma de
silenciarla es el menú de Android. Para un móvil familiar compartido (o para quien solo quiere los
avisos de un grupo) el ajuste del sistema es demasiado grueso: no distingue «esta app» de «estos
avisos».

**Comportamiento esperado.**
- Interruptor encendido: el dispositivo queda registrado y recibe push (lo de hoy).
- Interruptor apagado: el servidor **deja de enviar** a ese dispositivo. No basta con ignorar la
  notificación en el cliente: el token debe revocarse en `public.devices`, para que no se gaste
  cuota de FCM ni se registre el evento como entregado a alguien que no lo quiere.
- Al volver a encenderlo, el token se vuelve a registrar y el estado de la fila pasa a «Listo».
- La preferencia se recuerda entre arranques y **sobrevive a la actualización** del APK.

**Decisiones que faltan (propietario).**
- Si el nuevo ajuste **sustituye** al permiso del sistema o convive con él (recomendado: convive;
  si el permiso del sistema está denegado, el interruptor se muestra apagado y no se puede encender
  sin pedirlo otra vez).
- Si apagarlo afecta a todos los grupos o se quiere por grupo (recomendado: global en v1; por grupo
  es otra pantalla y otro modelo de datos).
- Si el panel debe mostrar en la ficha del usuario «push activado/desactivado» (útil para soporte).

**Alcance técnico.**
- App: `PrefsStringStore` + `AppViewModel` (ya expone `pushStatus`, `retryPush` y `revoke()`), y
  `FcmRegistrar.clear()`.
- Servidor: ya hay `DELETE /api/v1/devices/{id}` y el envío filtra por `revoked_at is null`.
- Tests: apagar dos veces es idempotente; encender tras apagar vuelve a dejar un token activo; el
  servidor no envía a un dispositivo revocado.

**Cuidado.** El permiso `POST_NOTIFICATIONS` de Android 13+ es independiente de este ajuste. Si el
usuario lo deniega en el sistema, la app no puede notificar aunque el interruptor esté encendido:
la fila debe decirlo con claridad en vez de mentir con un «Listo».

---

## 2. Editar una liquidación abre el formulario de gasto

**Qué.** Tocar un pago en Actividad abre `ExpenseDialog`, que permite varios participantes: el
servidor lo rechaza (una liquidación tiene un único receptor distinto del pagador) y el usuario ve
un error genérico.

**Plan.** Modo edición en `ManualPaymentDialog` (pagador, receptor, importe y fecha) y abrirlo
cuando `kind = settlement`. Mientras no exista, la fila del pago no debería ser editable.

---

## 3. El importador crea miembros antes de confirmar

**Qué.** Al asignar un nombre en el paso de mapeo, la app ya hace `POST /members`; si el usuario
cancela, el grupo queda con miembros nuevos (invitados o ficticios).

**Plan.** Enviar el mapeo solo en el commit y crear los miembros dentro de la transacción del
importador: `commitImport` acepta ya un `mapping`, y falta que acepte los nombres nuevos
(`newMembers`) para crearlos con el mismo bloqueo por grupo.

---

## 4. Idempotencia también en el commit del importador

**Qué.** El alta de gastos ya acepta `Idempotency-Key`. El commit de una importación no: hoy un
reintento es inocuo porque las filas repetidas se saltan, pero conviene que el contrato lo diga
explícitamente (o extender la misma tabla `owe_no_idempotency` al import).

**Decisión.** Se puede cerrar documentando en la spec que el import es idempotente por deducción
de filas, o extenderlo con clave como los movimientos. Recomendado: documentarlo y no añadir
maquinaria.

---

## 6. Eliminar una instancia guardada en la app

**Qué se quiere.** Desde el selector de instancia de la app («Cambiar instancia») poder **quitar**
una instancia que ya no se usa. Hoy solo se pueden añadir y elegir; una instancia equivocada se
queda en la lista para siempre.

**Por qué.** Aparece al probar la migración: tras cambiar de instancia para una prueba, la de
producción y la local conviven en la lista sin forma de limpiar la que sobra.

**Decisiones pendientes.**
- Gesto: botón «Quitar» en cada fila del selector (no en la instancia activa) frente a pulsación
  larga. Un botón explícito es más descubrible y accesible.
- Qué pasa si es la activa: no se puede quitar sin cambiar antes; el selector lo explica.
- Si la instancia tiene sesión guardada, cerrarla al quitarla (no dejar restos cifrados).

**Qué toca.**
- `InstanceStore` (`apps/android/.../InstanceStore.kt`): `remove(url)` que no borre la última ni la
  activa, y limpie la sesión si esa instancia era la dueña.
- `LoginScreen`/selector de instancia: acción «Quitar» con confirmación y aviso si es la activa.
- Textos en los 9 idiomas (`Strings.kt`) y tests del store (quitar la activa se rechaza; quitar una
  inactiva la elimina; la sesión de otra instancia no se toca).
- `docs/ai/landing.md` no cambia: es una pantalla de la app, no del producto público.
