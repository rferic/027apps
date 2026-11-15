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
