---
id: sprint-infra-task-08
titulo: Proyecto Firebase + FCM (notificaciones push)
area: infra
estado: en curso
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
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
- **Valores públicos capturados** en una nota local fuera del repo (`~/Documents/027apps-firebase/nota-firebase.txt`): `fcm_project_id`, `fcm_app_id`, `fcm_sender_id`, `fcm_api_key`. Se trasladarán a `settings` (categoría `notifications.push`) cuando exista el panel del Core.
- **Pendiente (usuario)**: generar la cuenta de servicio (JSON) y guardarla en el gestor de contraseñas; subirla cifrada a `settings` cuando exista el panel. Verificación end-to-end pendiente del Core (`POST /devices` + envío FCM).
- **Recomendación**: restringir la API key en Google Cloud (solo app Android `com.rferic.zero27apps` y APIs necesarias, p. ej. FCM) para limitar abuso.

**Notas**:
- Es **opcional** para cualquier instancia (degradación elegante: sin FCM, realtime + bandeja de novedades), pero **obligatoria para la instancia del autor** (decisión del usuario, 2026-10-26).
- El APK es **único** para todas las instancias: la configuración se hace **en runtime** desde settings (valores públicos) — nunca se hornea `google-services.json` en el build.
- El service account JSON **nunca** va a git ni a logs (`guard-secrets` del CI).
- Depende de: Core implementado con `POST /devices` y el envío FCM (task-04 del sprint de diseño del Core).

**Criterios de aceptación**: proyecto Firebase creado; valores públicos en settings; service account cifrado; push verificado con la app cerrada; sin secrets en el repo.
