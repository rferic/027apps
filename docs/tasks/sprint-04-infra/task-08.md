---
id: sprint-04-task-08
titulo: Proyecto Firebase + FCM (notificaciones push)
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-sprint-04-infra.md
fuente: docs/superpowers/specs/2026-10-26-realtime-notificaciones.md §6
---

**Tarea**: crear el proyecto Firebase de la instancia y configurar **FCM (push)** para que las notificaciones lleguen con la app cerrada.

**Pasos (puerta de setup del usuario — solo los puede hacer él)**:
1. Crear un **proyecto Firebase gratuito** (cuenta Google).
2. Registrar la app Android con el **package name del APK** de 027Apps.
3. Copiar los valores **públicos** al panel/wizard (`settings`, categoría `notifications.push`, task-06): `fcm_project_id`, `fcm_app_id`, `fcm_api_key`, `fcm_sender_id`.
4. Generar una **cuenta de servicio** (service account JSON) y subirla para que el servidor pueda enviar por **FCM HTTP v1**; se guarda **cifrada** en `settings` (`value_encrypted`, clave maestra en env).
5. Verificar de extremo a extremo: un evento con `notify: ["push"]` llega al dispositivo con la app cerrada.

## Bitácora (2026-11-01)

- **Proyecto Firebase creado**: `027apps` (ID `apps-4d26a`, número `387852103349`), plan Spark. App Android registrada con package `com.rferic.zero27apps` y alias `027Apps`.
- **Valores públicos capturados** en una nota local ignorada por git (`private/firebase/nota-firebase.txt`): `fcm_project_id`, `fcm_app_id`, `fcm_sender_id`, `fcm_api_key`. Se trasladarán a `settings` (categoría `notifications.push`) cuando exista el panel del Core. La carpeta `private/` no es un backup; el service account vive en el gestor de contraseñas.
- **Pendiente**: subir el JSON de la cuenta de servicio (ya guardado por el usuario) al panel de `settings` cuando exista el Core; verificación end-to-end (`POST /devices` + envío FCM) en el sprint del Core.
- **API key restringida** (2026-11-01): *Application restrictions* → Android apps con package `com.rferic.zero27apps` y SHA-1 `05:C0:03:5D:21:C7:B0:78:F2:BA:41:D9:1D:16:3D:E4:EB:6C:30:06`; *API restrictions* → APIs existentes + Firebase Cloud Messaging.
  - **Actualizado por el usuario** (2026-11-01): la restricción de la API key en Google Cloud Console ahora apunta al SHA-1 del keystore canónico (`F0:A5:D0:38:87:91:02:0C:A6:99:15:96:5F:41:19:A6:23:A1:9B:61`); el SHA-1 del keystore descartado quedó eliminado. Listo para firmar APKs de release.
- **Cuenta de servicio generada y guardada por el usuario** (2026-11-01) en su gestor de contraseñas/Drive. El JSON no pasa por git ni por el chat; se subirá cifrado a `settings` cuando exista el panel del Core.
- **Cierre de la parte de infra** (2026-11-01): todo lo que dependía de cuentas externas está hecho (proyecto, app Android, valores públicos capturados, service account guardado, API key restringida al SHA-1 canónico). El estado pasa a `test`: la verificación end-to-end (subida del service account cifrado a `settings`, `POST /devices`, envío FCM con la app cerrada) se ejecuta en el sprint del Core y es el criterio que falta para `finalizada`.
- **Traslado de la verificación** (2026-10-31): al cerrar sprint-04-infra, la verificación end-to-end se registra como criterio del **task-06 del sprint-09-core-data** (realtime, outbox, push y jobs), donde se implementan `POST /devices` y el envío FCM. Esta tarea queda `finalizada` por su alcance de infra (setup de cuentas externas completo y auditado).

**Notas**:
- Es **opcional** para cualquier instancia (degradación elegante: sin FCM, realtime + bandeja de novedades), pero **obligatoria para la instancia del autor** (decisión del usuario, 2026-10-26).
- El APK es **único** para todas las instancias: la configuración se hace **en runtime** desde settings (valores públicos) — nunca se hornea `google-services.json` en el build.
- El service account JSON **nunca** va a git ni a logs (`guard-secrets` del CI).
- Depende de: Core implementado con `POST /devices` y el envío FCM (task-04 del sprint de diseño del Core).

**Criterios de aceptación**: proyecto Firebase creado; valores públicos en settings; service account cifrado; push verificado con la app cerrada; sin secrets en el repo.
