# Backlog — trabajo anotado y no planificado

Ideas y mejoras aceptadas por el propietario que **no** entran en el sprint en curso. Cada entrada
dice qué se quiere, por qué, qué decisiones faltan y qué toca (app, servidor o panel). Cuando una
entrada entra en un sprint se convierte en `docs/tasks/sprint-NN-<slug>/task-MM.md` y se borra de
aquí.

| # | Título | Área | Anotado | Origen |
|---|---|---|---|---|
| 1 | Ajuste para activar/desactivar las notificaciones push | app + servidor | 2026-11-15 | propietario, tras verificar la push real |
| 2 | Versión del APK a la vista en el botón de descarga | web | 2026-11-15 | propietario (ya es la tarea 12 del sprint 15) |

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
- App: `PrefsStringStore` + `AppViewModel` (ya expone `pushStatus` y `retryPush`), y
  `FcmRegistrar.clear()` para revocar.
- Servidor: borrar o marcar `revoked_at` en `public.devices` de ese usuario; el envío ya filtra por
  `revoked_at is null`.
- Tests: apagar dos veces es idempotente; encender tras apagar vuelve a dejar un token activo; el
  servidor no envía a un dispositivo revocado.
- Docs: `docs/flows/` de push y la ficha de la app en `docs/ai/landing.md` si cambia la captura.

**Cuidado.** El permiso `POST_NOTIFICATIONS` de Android 13+ es independiente de este ajuste. Si el
usuario lo deniega en el sistema, la app no puede notificar aunque el interruptor esté encendido:
la fila debe decirlo con claridad en vez de mentir con un «Listo».

---

## 2. Versión del APK a la vista en el botón de descarga

Ya promovida a la **tarea 12** del sprint 15 (`docs/tasks/sprint-15-app-y-finanzas/task-12.md`):
la versión en pequeño bajo el botón de descarga, tomada de `latestAndroidRelease()` con su caché de
cinco minutos. Se deja aquí solo como referencia de por qué está en el sprint.

## 3. RLS del módulo alineada con el dominio

**Qué.** Las políticas de `module_owe_no` (`001-init.sql`) y las reglas del servicio no coinciden.
Hoy la API va con `service_role` (que ignora RLS), así que no se nota, pero la defensa en
profundidad miente: aceptar una invitación o salir del grupo fallaría si se consultara como
`authenticated`, y a la vez cualquier miembro activo podría editar o borrar físicamente movimientos
de otro.

**Plan.** Migración del módulo `1.8.0` con políticas separadas por operación: `INSERT`/`UPDATE` de
movimientos solo para autor o creador, sin `DELETE` físico (la baja es lógica), escrituras
bloqueadas si el grupo está archivado, y transición de estado propia para invitado y saliente.
Test en `db-tests` impersonando `authenticated`.

**Por qué no está hecho.** Cambiar políticas sin ejercitarlas contra el dominio es la forma más
fácil de romper producción en silencio; merece su propia tarea con la batería de aislamiento
delante.

## 4. Monedas mezcladas en el widget y en el resumen del panel

**Qué.** El widget de la app suma céntimos de grupos en divisas distintas y les pone el símbolo del
último grupo; el resumen del panel hace lo mismo con `sum(amount_minor)` y la moneda del primer
grupo.

**Decisión pendiente.** Una sola moneda por grupo ya está; falta elegir qué ve quien tiene grupos en
varias: (a) solo la moneda principal del perfil, (b) una línea por divisa, (c) la del grupo más
reciente sin sumar. Recomendado (b) en el panel y (b) en el widget, con un máximo de dos líneas.

## 5. Token FCM caducado tras una rotación

**Qué.** `FcmRegistrar` guarda una copia del JWT de sesión; cuando Firebase rota el token días
después, `onNewToken` la usa y el `POST /devices` responde 401. El usuario deja de recibir push
hasta que abre la app (que sí vuelve a registrarse con un JWT fresco).

**Plan.** Guardar el token pendiente en preferencias y sincronizarlo al arrancar con la sesión
renovada, o registrar desde un worker que refresque la sesión de Supabase antes.

## 6. La tarjeta de OweNo en Inicio espera un `delay` fijo

**Qué.** `OweNoHomeCard` lanza un `OneTimeWorkRequest` y espera 1,5 s; si el worker tarda más (en
frío hace 1 + 3·N llamadas), la tarjeta se queda con datos viejos o vacía.

**Plan.** Exponer `WidgetSnapshotStore` como `Flow` sobre `OnSharedPreferenceChangeListener` y
quitar el `delay`.

## 7. Editar una liquidación abre el formulario de gasto

**Qué.** Tocar un pago en Actividad abre `ExpenseDialog`, que permite varios participantes: el
servidor lo rechaza y el usuario ve un error genérico.

**Plan.** Modo edición en `ManualPaymentDialog` (pagador, receptor, importe y fecha) y abrirlo para
`kind = settlement`.

## 8. Cobertura de textos y de la política de actualización

**Qué.** `Updater` ya tiene tests (`UpdatePolicyTest`, 6 casos). `AppStringsTest` sigue comprobando
72 de las ~215 claves a mano.

**Plan.** Reflexión sobre `Strings` para exigir que ninguna clave quede vacía y que los
placeholders `{...}` coincidan con `AppStrings.en` en los 9 idiomas.

## 9. El importador crea miembros antes de confirmar

**Qué.** Al asignar un nombre en el paso de mapeo, la app ya hace `POST /members`; si el usuario
cancela, el grupo queda con miembros nuevos.

**Plan.** Enviar el mapeo solo en el commit (el contrato ya lo acepta) y crear los miembros dentro
de la transacción del importador.
